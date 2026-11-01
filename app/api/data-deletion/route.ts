import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getMetaAppSecret } from '@/lib/meta/config';
import { acceptDataDeletionRequest, lookupDataDeletion } from '@/lib/meta/data-deletion';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code') || new URL(request.url).searchParams.get('id');
  if (!code) {
    return NextResponse.redirect(`${getSiteUrl()}/data-deletion`, 302);
  }
  try {
    const db = await getDb();
    const status = await lookupDataDeletion(db, code);
    if (!status) {
      return NextResponse.json({ confirmation_code: code, status: 'unknown' }, { status: 404 });
    }
    return NextResponse.json(status);
  } catch (error) {
    console.error('[meta] data_deletion_lookup_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to load deletion status.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const secret = getMetaAppSecret();
  if (!secret) {
    return NextResponse.json({ error: 'Data deletion callback is not configured.' }, { status: 503 });
  }

  let signedRequest = '';
  const contentType = request.headers.get('content-type') || '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await request.json()) as { signed_request?: string };
      signedRequest = String(body.signed_request || '');
    } else {
      const text = await request.text();
      signedRequest = new URLSearchParams(text).get('signed_request') || '';
    }
  } catch {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await acceptDataDeletionRequest(db, signedRequest, secret);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    console.info('[meta] data_deletion_received', result.confirmation_code);
    return NextResponse.json({ url: result.url, confirmation_code: result.confirmation_code });
  } catch (error) {
    console.error('[meta] data_deletion_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Unable to record deletion request.' }, { status: 500 });
  }
}
