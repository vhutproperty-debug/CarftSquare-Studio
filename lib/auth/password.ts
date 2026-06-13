import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

function hashPasswordScrypt(password: string, salt = randomBytes(16).toString('hex')): string {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPasswordScrypt(password: string, storedHash = ''): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash || storedHash.startsWith('$2')) return false;
  const candidate = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(String(password), BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, storedHash = ''): boolean {
  if (!storedHash) return false;
  if (storedHash.startsWith('$2')) {
    return bcrypt.compareSync(String(password), storedHash);
  }
  return verifyPasswordScrypt(password, storedHash);
}

export function needsPasswordRehash(storedHash = ''): boolean {
  return Boolean(storedHash) && !storedHash.startsWith('$2');
}

export { hashPasswordScrypt };
