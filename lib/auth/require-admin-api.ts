import type { Db } from 'mongodb';
// @ts-expect-error JS module
import { getDb } from '@/lib/mongodb';
// @ts-expect-error JS module
import { readSessionToken, SESSION_COOKIE } from '@/lib/auth/session';

export async function requireAdminFromRequest(request: Request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = readSessionToken(token);
  if (!session?.id) return null;
  const db: Db = await getDb();
  const admin = await db.collection('admins').findOne(
    { id: session.id, role: 'admin' },
    { projection: { _id: 0, passwordHash: 0 } },
  );
  return admin || null;
}
