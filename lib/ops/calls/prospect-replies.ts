import type { Db } from 'mongodb';
import { isStopKeyword } from '@/lib/whatsapp-cloud/consent';
import { findProspectsForWaId, updateProspect } from '@/lib/ops/calls/prospect-store';
import type { CallDisplayStatus } from '@/lib/ops/calls/statuses';
import type { OpsProspect, ProspectIntent } from '@/lib/ops/calls/types';

export type OwnerReplySignal =
  | { kind: 'opt_out'; label: string }
  | { kind: 'intent'; intent: ProspectIntent; callStatus: 'INTERESTED' | 'FOLLOW_UP'; label: string };

const INTENT_BY_LABEL: Record<string, { intent: ProspectIntent; callStatus: 'INTERESTED' | 'FOLLOW_UP' }> = {
  sell: { intent: 'sell', callStatus: 'INTERESTED' },
  'rent out': { intent: 'rent', callStatus: 'INTERESTED' },
  rent: { intent: 'rent', callStatus: 'INTERESTED' },
  interiors: { intent: 'interiors', callStatus: 'INTERESTED' },
  interior: { intent: 'interiors', callStatus: 'INTERESTED' },
  'not now': { intent: 'not_now', callStatus: 'FOLLOW_UP' },
};

export function mapOwnerReply(text: string | null | undefined): OwnerReplySignal | null {
  const label = String(text || '').trim();
  if (!label) return null;
  if (isStopKeyword(label)) return { kind: 'opt_out', label };
  const mapped = INTENT_BY_LABEL[label.toLowerCase()];
  if (!mapped) return null;
  return { kind: 'intent', ...mapped, label };
}

function nextStatus(prospect: OpsProspect, status: CallDisplayStatus): CallDisplayStatus {
  if (prospect.optOut || prospect.doNotContact || prospect.callStatus === 'DO_NOT_CALL') {
    return 'DO_NOT_CALL';
  }
  if (prospect.callStatus === 'CONVERTED') return 'CONVERTED';
  return status;
}

/**
 * Persist a quick-reply or STOP onto every matching owner.
 * Opt-out wins over intent and is not cleared by a later button.
 */
export async function applyProspectWhatsAppReply(
  db: Db,
  waId: string,
  text: string | null | undefined,
): Promise<{ updated: number; signal: OwnerReplySignal | null }> {
  const signal = mapOwnerReply(text);
  if (!signal) return { updated: 0, signal: null };
  const prospects = await findProspectsForWaId(db, waId);
  if (!prospects.length) return { updated: 0, signal };

  for (const prospect of prospects) {
    if (signal.kind === 'opt_out') {
      await updateProspect(db, prospect.id, {
        optOut: true,
        doNotContact: true,
        callStatus: 'DO_NOT_CALL',
        lastButtonReply: signal.label,
      });
      continue;
    }
    await updateProspect(db, prospect.id, {
      intent: signal.intent,
      lastButtonReply: signal.label,
      callStatus: nextStatus(prospect, signal.callStatus),
    });
  }

  return { updated: prospects.length, signal };
}
