import {
  getSessionSecret,
  getSessionTokenFromRequest,
  parseSessionPayload,
} from '@/lib/auth/session-constants';

function bytesToBase64url(bytes) {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqualString(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function signEncodedPayload(encoded) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encoded));
  return bytesToBase64url(new Uint8Array(signature));
}

export async function readSessionToken(token) {
  if (!token || !token.includes('.')) return null;

  const [encoded, signature] = token.split('.');
  const expected = await signEncodedPayload(encoded);
  if (!timingSafeEqualString(signature || '', expected)) return null;

  return parseSessionPayload(encoded);
}

export async function getSessionFromRequest(request) {
  return readSessionToken(getSessionTokenFromRequest(request));
}
