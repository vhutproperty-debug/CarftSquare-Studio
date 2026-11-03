/**
 * WABA restriction. Sends stay blocked until the override and Meta both say unrestricted.
 * Run: npx tsx scripts/waba-restriction.test.ts
 */
import assert from 'node:assert/strict';
import { clearWhatsAppSendCache, getWhatsAppSendDecision, isWhatsAppSendingPausedSync } from '../lib/whatsapp-cloud/send-policy';
import {
  BUSINESS_VERIFICATION_REASON,
  evaluateWabaRestriction,
  parseWabaRestrictionPayload,
  readSendOverride,
} from '../lib/whatsapp-cloud/waba-restriction';

const healthy = parseWabaRestrictionPayload({
  account_review_status: 'APPROVED',
  business_verification_status: 'verified',
  health_status: { can_send_message: 'AVAILABLE', entities: [] },
});

async function main() {
  const previous = process.env.WHATSAPP_WABA_SEND_OVERRIDE;
  delete process.env.WHATSAPP_WABA_SEND_OVERRIDE;
  clearWhatsAppSendCache();
  assert.equal(readSendOverride(), 'blocked');
  assert.equal(isWhatsAppSendingPausedSync(), true);
  const defaultBlocked = evaluateWabaRestriction({ override: 'blocked', snapshot: healthy });
  assert.equal(defaultBlocked.blocked, true);
  assert.match(defaultBlocked.reason, /WHATSAPP_WABA_SEND_OVERRIDE=unrestricted/);

  const verified = evaluateWabaRestriction({ override: 'unrestricted', snapshot: healthy });
  assert.equal(verified.blocked, false);

  const unverified = evaluateWabaRestriction({
    override: 'unrestricted',
    snapshot: parseWabaRestrictionPayload({
      account_review_status: 'APPROVED',
      business_verification_status: 'not_verified',
      health_status: {
        can_send_message: 'BLOCKED',
        entities: [{
          can_send_message: 'BLOCKED',
          errors: [{ error_description: 'Solution Provider will need to verify your business' }],
        }],
      },
    }),
  });
  assert.equal(unverified.blocked, true);
  assert.match(unverified.reason, /Solution Provider will need to verify your business/);

  const missing = evaluateWabaRestriction({
    override: 'unrestricted',
    snapshot: null,
    graphError: 'Meta Graph HTTP 400',
  });
  assert.equal(missing.blocked, true);
  assert.match(missing.reason, /Meta Graph HTTP 400/);
  assert.match(BUSINESS_VERIFICATION_REASON, /verify your business/);

  process.env.WHATSAPP_WABA_SEND_OVERRIDE = 'blocked';
  clearWhatsAppSendCache();
  const decision = await getWhatsAppSendDecision(undefined, async () => ({ snapshot: healthy, error: null }));
  assert.equal(decision.blocked, true);
  assert.equal(decision.canSendMessage, 'AVAILABLE');

  process.env.WHATSAPP_WABA_SEND_OVERRIDE = 'unrestricted';
  clearWhatsAppSendCache();
  const open = await getWhatsAppSendDecision(undefined, async () => ({ snapshot: healthy, error: null }));
  assert.equal(open.blocked, false);

  if (previous == null) delete process.env.WHATSAPP_WABA_SEND_OVERRIDE;
  else process.env.WHATSAPP_WABA_SEND_OVERRIDE = previous;
  clearWhatsAppSendCache();
  console.log('waba-restriction: ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
