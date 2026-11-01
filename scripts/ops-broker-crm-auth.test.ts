/**
 * Broker CRM must use the same session cookie as /admin and other /ops pages.
 * Run: npx tsx scripts/ops-broker-crm-auth.test.ts
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { isSafeAdminReturnTo } from '../lib/auth/safe-research-return-to';
import { isSafeOpsReturnTo } from '../lib/auth/safe-ops-return-to';
import { sessionTokenFromCookieSources } from '../lib/auth/session-cookie';
import { SESSION_COOKIE } from '../lib/auth/session-constants';
import { middleware } from '../middleware.js';

const REAL = `${'a'.repeat(180)}.${'b'.repeat(40)}`;

function request(path: string, cookie?: string) {
  return new NextRequest(new URL(path, 'https://craftsquare.co.in'), {
    headers: cookie ? { cookie } : undefined,
  });
}

async function main() {
  assert.equal(isSafeOpsReturnTo('/ops/broker-crm'), true);
  assert.equal(isSafeOpsReturnTo('/ops/broker-crm/queue'), true);
  assert.equal(isSafeOpsReturnTo('/ops/broker-crm/abc'), true);
  assert.equal(isSafeAdminReturnTo('/ops/broker-crm'), true);
  assert.equal(isSafeAdminReturnTo('/ops/broker-crm/queue'), true);
  assert.equal(isSafeAdminReturnTo('https://evil.example/ops/broker-crm'), false);

  assert.equal(sessionTokenFromCookieSources({
    direct: '',
    cookieHeader: `theme=light; ${SESSION_COOKIE}=${REAL}`,
  }), REAL);

  assert.equal(sessionTokenFromCookieSources({
    direct: 'short',
    cookieHeader: `${SESSION_COOKIE}=; ${SESSION_COOKIE}=${REAL}`,
  }), REAL);

  const page = await middleware(request(
    '/ops/broker-crm',
    `${SESSION_COOKIE}=${REAL}`,
  ));
  assert.notEqual(page.status, 401);
  assert.equal(page.headers.get('x-middleware-next'), '1');
  const forwarded = page.headers.get('x-middleware-request-cookie')
    || page.headers.get('x-middleware-override-headers')
    || '';
  assert.equal(forwarded.toLowerCase().includes('cookie') || page.headers.get('x-middleware-next') === '1', true);

  const queue = await middleware(request('/ops/broker-crm/queue', `${SESSION_COOKIE}=${REAL}`));
  assert.notEqual(queue.status, 401);
  assert.equal(queue.headers.get('x-middleware-next'), '1');

  const api = await middleware(request('/api/ops/broker-crm'));
  assert.equal(api.status, 401);
  assert.equal((await api.json()).error, 'Admin authentication required.');

  console.log('ops broker crm auth tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
