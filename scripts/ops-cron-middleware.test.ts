/**
 * Cron routes must reach their own secret check.
 * Middleware used to 401 every /api/ops/* call that had no session cookie,
 * so Authorization: Bearer CRON_SECRET never arrived at authorizeTick.
 *
 * Run: yarn test:ops-cron-middleware
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NextRequest } from 'next/server';
import { isCronAuthPath, middleware } from '../middleware.js';

const ADMIN_AUTH_ERROR = 'Admin authentication required.';

function request(path: string, init?: { method?: string; headers?: Record<string, string> }) {
  return new NextRequest(new URL(path, 'https://craftsquare.co.in'), init);
}

async function main() {
  const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
    crons?: Array<{ path: string }>;
  };
  const cronPaths = (vercel.crons || []).map((cron) => cron.path);
  assert.ok(cronPaths.includes('/api/ops/followups/tick'));
  for (const path of cronPaths) {
    assert.equal(isCronAuthPath(path), true, `${path} must skip the middleware session gate`);
  }

  assert.equal(isCronAuthPath('/api/ops/followups/tick/'), true);
  assert.equal(isCronAuthPath('/api/ops/whatsapp/templates/sync'), true);
  assert.equal(isCronAuthPath('/api/ops/ads/insights/sync'), true);
  assert.equal(isCronAuthPath('/api/research/scheduler/tick'), true);
  assert.equal(isCronAuthPath('/api/ops/followups'), false);
  assert.equal(isCronAuthPath('/api/ops/followups/tick-extra'), false);
  assert.equal(isCronAuthPath('/api/ops/dashboard'), false);
  assert.equal(isCronAuthPath('/api/research/health'), false);

  const tick = await middleware(request('/api/ops/followups/tick', {
    method: 'POST',
    headers: { authorization: 'Bearer cron-secret' },
  }));
  assert.notEqual(tick.status, 401);
  assert.equal(tick.headers.get('x-middleware-next'), '1');

  const vercelGet = await middleware(request('/api/ops/followups/tick', {
    method: 'GET',
    headers: { authorization: 'Bearer cron-secret' },
  }));
  assert.equal(vercelGet.headers.get('x-middleware-next'), '1');

  for (const path of [
    '/api/ops/whatsapp/templates/sync',
    '/api/ops/ads/insights/sync',
    '/api/research/scheduler/tick',
  ]) {
    const response = await middleware(request(path, {
      method: 'GET',
      headers: { authorization: 'Bearer cron-secret' },
    }));
    assert.equal(response.headers.get('x-middleware-next'), '1', path);
    assert.notEqual(response.status, 401, path);
  }

  const followups = await middleware(request('/api/ops/followups'));
  assert.equal(followups.status, 401);
  assert.equal((await followups.json()).error, ADMIN_AUTH_ERROR);

  const dashboard = await middleware(request('/api/ops/dashboard'));
  assert.equal(dashboard.status, 401);
  assert.equal((await dashboard.json()).error, ADMIN_AUTH_ERROR);

  const research = await middleware(request('/api/research/health'));
  assert.equal(research.status, 401);
  assert.equal((await research.json()).error, ADMIN_AUTH_ERROR);

  const nearMiss = await middleware(request('/api/ops/followups/tick-extra', {
    method: 'POST',
    headers: { authorization: 'Bearer cron-secret' },
  }));
  assert.equal(nearMiss.status, 401);
  assert.equal((await nearMiss.json()).error, ADMIN_AUTH_ERROR);

  console.log('ops-cron-middleware: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
