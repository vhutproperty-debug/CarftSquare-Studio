import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { hasPermission } from '@/lib/auth/rbac/roles';
import { logAuditEvent } from '@/lib/auth/rbac/audit';
import { getDatabase } from '@/lib/auth/rbac/store';
import { MODULES } from '@/lib/auth/rbac/modules';
import { blogCreateSchema } from '@/lib/blog/schemas';
import { getDatabase as getBlogDb, listAdminBlogPosts, saveBlogPost } from '@/lib/blog/store';

function requireBlogView(request: Request) {
  return authorizeRequest(request, { permission: MODULES.BLOG, action: 'view' });
}

function canPublish(admin: { role?: string; permissions?: unknown } | null, status?: string) {
  if (status !== 'published') return true;
  return hasPermission(admin, MODULES.BLOG, 'publish');
}

export async function GET(request: Request) {
  const auth = await requireBlogView(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') || '1');
  const limit = Number(searchParams.get('limit') || '12');
  const q = searchParams.get('q') || undefined;
  const statusParam = searchParams.get('status') || 'all';
  const category = searchParams.get('category') || undefined;
  const status = ['draft', 'published', 'archived', 'all'].includes(statusParam)
    ? (statusParam as 'draft' | 'published' | 'archived' | 'all')
    : 'all';

  try {
    const db = await getBlogDb();
    const result = await listAdminBlogPosts(db, { page, limit, q, status, category });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load blog posts' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await authorizeRequest(request, { permission: MODULES.BLOG, action: 'create' });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const body = await request.json();
  const parsed = blogCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!canPublish(auth.admin, parsed.data.status)) {
    return NextResponse.json({ error: 'You do not have permission to publish blog posts.' }, { status: 403 });
  }

  try {
    const db = await getBlogDb();
    const post = await saveBlogPost(db, {
      ...parsed.data,
      publishedAt: parsed.data.status === 'published' ? new Date().toISOString() : undefined,
    });
    if (!post) {
      return NextResponse.json({ error: 'Title and slug are required.' }, { status: 400 });
    }

    const auditDb = await getDatabase();
    await logAuditEvent(auditDb, parsed.data.status === 'published' ? 'publish' : 'create', {
      request,
      actorId: auth.admin.id,
      actorEmail: auth.admin.email,
    }, 'blog', { resourceId: post.id, details: { slug: post.slug } });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create blog post';
    const status = /slug already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
