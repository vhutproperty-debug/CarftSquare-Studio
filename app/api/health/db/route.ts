import { NextResponse } from 'next/server';
import { withTimeout } from '@/lib/auth/async-timeout';
import { getDb, isMongoReady } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 15;

const HEALTH_CONNECT_TIMEOUT_MS = 10_000;
const HEALTH_PING_TIMEOUT_MS = 4_000;

/**
 * Lightweight ping used by the 10-minute GitHub Actions tick to keep a
 * serverless isolate and its Mongo client warm. No auth, no index build wait
 * beyond what getDb already caps, and no connection details in the body.
 */
export async function GET() {
  const started = Date.now();
  const warm = isMongoReady();
  try {
    const db = await withTimeout(getDb(), HEALTH_CONNECT_TIMEOUT_MS, 'health_getDb');
    await withTimeout(db.command({ ping: 1 }), HEALTH_PING_TIMEOUT_MS, 'health_ping');
    return NextResponse.json({
      ok: true,
      warm: warm || isMongoReady(),
      ms: Date.now() - started,
    });
  } catch (error) {
    console.error('[health] db_ping_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { ok: false, warm, ms: Date.now() - started },
      { status: 503 },
    );
  }
}
