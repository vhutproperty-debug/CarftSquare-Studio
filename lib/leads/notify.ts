import { waitUntil } from '@vercel/functions';
import { isMetaLeadsEnabled } from '@/lib/meta/config';
import { onNewLead, type NewLeadInput } from '@/lib/leads/pipeline';

/** Fire-and-forget lead automation for website forms. Never blocks the HTTP response. */
export function notifyNewWebsiteLead(lead: NewLeadInput): void {
  if (!isMetaLeadsEnabled()) return;
  const task = onNewLead(lead).catch((error) => {
    console.warn('[leads] pipeline_failed', error instanceof Error ? error.message : error);
  });
  try {
    waitUntil(task);
  } catch {
    void task;
  }
}
