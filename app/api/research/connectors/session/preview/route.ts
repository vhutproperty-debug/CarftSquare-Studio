import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireResearchViewAccess } from '@/lib/research/auth';
import { getConnectSessionById } from '@/lib/research/browser-gateway/connect-session-store';
import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';

export const runtime = 'nodejs';

/** Serve latest live-connect preview frame (JPEG). No secrets. */
export async function GET(request: Request) {
  const auth = await requireResearchViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const session = await getConnectSessionById(id);
  if (!session?.previewPath) {
    return NextResponse.json({ error: 'Preview not available.' }, { status: 404 });
  }

  const allowedRoot = path.resolve(RESEARCH_BROWSER_CONFIG.screenshotRoot);
  const absolute = path.isAbsolute(session.previewPath)
    ? path.resolve(session.previewPath)
    : path.resolve(allowedRoot, session.previewPath);
  if (!absolute.startsWith(allowedRoot)) {
    return NextResponse.json({ error: 'Invalid preview path.' }, { status: 400 });
  }

  try {
    const buf = await fs.readFile(absolute);
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Preview not ready.' }, { status: 404 });
  }
}
