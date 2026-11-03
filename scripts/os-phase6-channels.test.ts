/**
 * Phase 6 channel safety and interior projects.
 * Run: npx tsx scripts/os-phase6-channels.test.ts
 */
import assert from 'node:assert/strict';
import { ChannelSafetyError, assertOsWhatsAppSendAllowed, planPausedCampaign } from '../lib/ops/channels/safety';
import { createInteriorProject, listInteriorProjects } from '../lib/ops/interior/store';
import { redactBrokerPayload } from '../lib/ops/os/redact';
import { pauseWhatsAppSending } from '../lib/whatsapp-cloud/send-policy';
import { createMemoryDb } from './lib/memory-db';

async function main() {
  const paused = planPausedCampaign({ name: 'Andheri rentals', status: 'PAUSED' });
  assert.equal(paused.status, 'PAUSED');
  assert.equal(paused.activate, false);
  assert.equal(paused.dailyBudgetInr, null);
  assert.throws(() => planPausedCampaign({ name: 'Go live', status: 'ACTIVE' }), ChannelSafetyError);
  assert.throws(() => planPausedCampaign({ name: 'Raise budget', dailyBudgetInr: 500 }), ChannelSafetyError);
  assert.throws(() => planPausedCampaign({ name: 'Raise budget', changeBudget: true }), ChannelSafetyError);

  assert.doesNotThrow(() => assertOsWhatsAppSendAllowed(false));
  assert.throws(() => assertOsWhatsAppSendAllowed(true), /WABA is restricted/);

  const db = createMemoryDb();
  await pauseWhatsAppSending(db as never, 'account restricted');
  const policy = await db.collection('ops_settings').findOne({ id: 'wa_send_policy' });
  assert.equal(policy?.paused, true);

  const project = await createInteriorProject(db as never, { title: 'Worli apartment', clientName: 'Meera', phone: '9811111111' }, 'int-1');
  assert.equal(project.stage, 'enquiry');
  const listed = await listInteriorProjects(db as never);
  assert.equal(listed.length, 1);
  const redacted = redactBrokerPayload(project);
  assert.equal('phone' in redacted, false);
  assert.equal('clientName' in redacted, false);
  assert.equal(redacted.title, 'Worli apartment');

  console.log('os-phase6-channels: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
