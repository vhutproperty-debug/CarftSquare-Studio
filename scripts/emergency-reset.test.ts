/**
 * Emergency reset stays hidden until both env vars are set, and a wrong
 * token never reaches Mongo. Run: npx tsx scripts/emergency-reset.test.ts
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

function post(headers?: Record<string, string>) {
  return new NextRequest('https://craftsquare.co.in/api/auth/emergency-reset', {
    method: 'POST',
    headers,
  });
}

async function main() {
  const previousPassword = process.env.ADMIN_RESET_PASSWORD;
  const previousToken = process.env.ADMIN_RESET_TOKEN;
  delete process.env.ADMIN_RESET_PASSWORD;
  delete process.env.ADMIN_RESET_TOKEN;

  try {
    const { POST } = await import('../app/api/auth/emergency-reset/route.js');

    const hidden = await POST(post());
    assert.equal(hidden.status, 404);
    assert.equal((await hidden.json()).error, 'Not found.');

    process.env.ADMIN_RESET_PASSWORD = 'temporary-password';
    const passwordOnly = await POST(post({ 'x-reset-token': 'anything' }));
    assert.equal(passwordOnly.status, 404);

    delete process.env.ADMIN_RESET_PASSWORD;
    process.env.ADMIN_RESET_TOKEN = 'temporary-token';
    const tokenOnly = await POST(post({ 'x-reset-token': 'temporary-token' }));
    assert.equal(tokenOnly.status, 404);

    process.env.ADMIN_RESET_PASSWORD = 'temporary-password';
    const wrong = await POST(post({ 'x-reset-token': 'not-the-token' }));
    assert.equal(wrong.status, 401);
    const wrongBody = await wrong.json();
    assert.equal(wrongBody.error, 'Unauthorized.');
    assert.equal(JSON.stringify(wrongBody).includes('temporary-'), false);

    const missingHeader = await POST(post());
    assert.equal(missingHeader.status, 401);
  } finally {
    if (previousPassword === undefined) delete process.env.ADMIN_RESET_PASSWORD;
    else process.env.ADMIN_RESET_PASSWORD = previousPassword;
    if (previousToken === undefined) delete process.env.ADMIN_RESET_TOKEN;
    else process.env.ADMIN_RESET_TOKEN = previousToken;
  }

  console.log('emergency-reset: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
