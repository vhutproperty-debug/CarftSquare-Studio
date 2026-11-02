/**
 * Outreach, re-rent, and portfolio helpers. No personal data.
 * Run: npx tsx scripts/outreach-modules.test.ts
 */
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { maskName, maskPhone } from '../lib/ops/portfolio/mask';
import { parseOutreachCsv, parseTemplatesJson } from '../lib/ops/outreach/parse';
import { renderOutreachTemplate } from '../lib/ops/outreach/template';
import { expiryBucket } from '../lib/ops/rerent/types';
import { isOpsProjectUpsertPath, middleware } from '../middleware.js';

function request(path: string, method = 'GET') {
  return new NextRequest(new URL(path, 'https://craftsquare.co.in'), { method });
}

async function main() {
  assert.equal(renderOutreachTemplate('Hi {first_name} at {project} {tower}', {
    name: 'Asha Mehta',
    project: 'Elysian',
    tower: 'B',
  }), 'Hi Asha at Elysian B');

  const rows = parseOutreachCsv('audience,phone,name\nowner_sell,9000000001,Example\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].audience, 'owner_sell');
  assert.equal(rows[0].phone, '9000000001');
  const templates = parseTemplatesJson('{"owner_sell":"Hi {first_name}"}');
  assert.equal(templates.owner_sell, 'Hi {first_name}');

  const today = new Date('2026-11-02T00:00:00Z');
  assert.equal(expiryBucket('', today), 'none');
  assert.equal(expiryBucket('2026-10-01', today), 'expired');
  assert.equal(expiryBucket('2026-11-20', today), '30');
  assert.equal(expiryBucket('2026-12-20', today), '60');
  assert.equal(expiryBucket('2027-01-20', today), '90');
  assert.equal(expiryBucket('2027-06-01', today), 'later');

  assert.equal(maskName('Asha Mehta'), 'Asha M.');
  assert.equal(maskPhone('+919000000001').endsWith('0001'), true);
  assert.equal(maskPhone('+919000000001').includes('900000'), false);

  assert.equal(isOpsProjectUpsertPath('/api/ops/outreach', 'POST'), true);
  assert.equal(isOpsProjectUpsertPath('/api/ops/rerent', 'PATCH'), true);
  assert.equal(isOpsProjectUpsertPath('/api/ops/portfolio-owners', 'POST'), true);
  assert.equal(isOpsProjectUpsertPath('/api/ops/outreach/import', 'POST'), false);
  const open = await middleware(request('/api/ops/outreach', 'POST'));
  assert.notEqual(open.status, 401);
  const blocked = await middleware(request('/api/ops/outreach'));
  assert.equal(blocked.status, 401);

  console.log('outreach module tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
