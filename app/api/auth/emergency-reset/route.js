import { createHash, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/auth/password';
import { getDb } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Static route. Next.js matches this ahead of the optional catch-all
 * app/api/[[...path]]/route.js, same as app/api/health/db/route.ts.
 * Middleware must list this path as public; the token check lives here.
 */
const TARGET_EMAIL = 'vhutproperty@gmail.com';
const TARGET_ROLES = ['super_admin', 'admin'];

/** Cleared when present on the admin document. Missing fields are a no-op. */
const LOCKOUT_FIELDS = [
  'failedAttempts',
  'failedLoginAttempts',
  'loginAttempts',
  'attemptCount',
  'lockoutUntil',
  'lockedUntil',
  'lockUntil',
  'lockout',
  'locked',
  'lastFailedAt',
  'lastFailedLoginAt',
];

function configuredReset() {
  const password = typeof process.env.ADMIN_RESET_PASSWORD === 'string'
    ? process.env.ADMIN_RESET_PASSWORD.trim()
    : '';
  const token = typeof process.env.ADMIN_RESET_TOKEN === 'string'
    ? process.env.ADMIN_RESET_TOKEN.trim()
    : '';
  if (!password || !token) return null;
  return { password, token };
}

function tokenMatches(provided, expected) {
  const left = createHash('sha256').update(String(provided), 'utf8').digest();
  const right = createHash('sha256').update(String(expected), 'utf8').digest();
  return timingSafeEqual(left, right);
}

export async function POST(request) {
  const reset = configuredReset();
  if (!reset) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const provided = (request.headers.get('x-reset-token') || '').trim();
  if (!tokenMatches(provided, reset.token)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const unset = {};
    for (const field of LOCKOUT_FIELDS) unset[field] = '';
    const result = await db.collection('admins').updateOne(
      { email: TARGET_EMAIL, role: { $in: TARGET_ROLES } },
      {
        $set: {
          passwordHash: hashPassword(reset.password),
          status: 'active',
          updatedAt: new Date().toISOString(),
        },
        $unset: unset,
      },
    );
    return NextResponse.json({
      ok: true,
      matched: result.matchedCount || 0,
      modified: result.modifiedCount || 0,
    });
  } catch {
    console.error('[auth] emergency_reset_failed');
    return NextResponse.json({ error: 'Reset failed.' }, { status: 500 });
  }
}
