import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { hasPermission } from '@/lib/auth/rbac/roles';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { getDatabase } from '@/lib/auth/rbac/store';
import { MODULES } from '@/lib/auth/rbac/modules';
import { blogDeleteSchema, blogUpdateSchema } from '@/lib/blog/schemas';
import {
  deleteBlogPost,
  getBlogPostById,
  getDatabase as getBlogDb,
  saveBlogPost,
} from '@/lib/blog/store';

type RouteContext = { params: { id: string } };

function canPublish(admin: { role?: string; permissions?: unknown } | null, status?: string) {
  if (status !== 'published') return true;
  return hasPermission(admin, MODULES.BLOG, 'publish');
}

export async function GET(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: MODULES.BLOG, action: 'view' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const db = await getBlogDb();
  const post = await getBlogPostById(db, params.id);
  if (!post) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: MODULES.BLOG, action: 'edit' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = blogUpdateSchema.safeParse({ ...body, id: params.id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getBlogDb();
  const existing = await getBlogPostById(db, params.id);
  if (!existing) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });

  const nextStatus = parsed.data.status || existing.status;
  if (!canPublish(auth.admin, nextStatus)) {
    return NextResponse.json({ error: 'You do not have permission to publish blog posts.' }, { status: 403 });
  }

  if (nextStatus === 'archived' && !hasPermission(auth.admin, MODULES.BLOG, 'archive')) {
    return NextResponse.json({ error: 'You do not have permission to archive blog posts.' }, { status: 403 });
  }

  try {
    const publishedAt = nextStatus === 'published' && existing.status !== 'published'
      ? new Date().toISOString()
      : existing.publishedAt;

    const post = await saveBlogPost(db, {
      ...existing,
      ...parsed.data,
      id: params.id,
      publishedAt,
    });
    if (!post) {
      return NextResponse.json({ error: 'Title and slug are required.' }, { status: 400 });
    }

    const auditDb = await getDatabase();
    const action = nextStatus === 'published' && existing.status !== 'published'
      ? 'publish'
      : nextStatus === 'archived' && existing.status !== 'archived'
        ? 'archive'
        : 'edit';

    await logAuditEvent(auditDb, action, {
      request,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
    }, 'blog', { resourceId: post.id, details: { slug: post.slug } });

    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update blog post';
    const status = /slug already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await authorizeRequest(request, { permission: MODULES.BLOG, action: 'delete' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const parsed = blogDeleteSchema.safeParse({ id: params.id, ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = await getBlogDb();
  const removed = await deleteBlogPost(db, params.id);
  if (!removed) return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });

  const auditDb = await getDatabase();
  await logAuditEvent(auditDb, 'delete', {
    request,
    actorId: auth.admin.id,
    actorEmail: auth.admin.email,
  }, 'blog', { resourceId: params.id });

  return NextResponse.json({ success: true });
}
