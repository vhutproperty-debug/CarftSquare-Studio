import { waitUntil } from '@vercel/functions';
import { isMetaLeadsEnabled } from '@/lib/meta/config';
import { onNewLead, type NewLeadInput } from '@/lib/leads/pipeline';
import { runOpsMaintenance } from '@/lib/ops/maintenance';

/** Fire-and-forget lead automation for website forms. Never blocks the HTTP response. */
export function notifyNewWebsiteLead(lead: NewLeadInput): void {
  if (!isMetaLeadsEnabled()) return;
  const task = (async () => {
    try {
      await onNewLead(lead);
    } catch (error) {
      console.warn('[leads] pipeline_failed', error instanceof Error ? error.message : error);
    }
    try {
      await runOpsMaintenance({ limit: 5, syncTemplates: true });
    } catch (error) {
      console.warn('[leads] maintenance_failed', error instanceof Error ? error.message : error);
    }
  })();
  try {
    waitUntil(task);
  } catch {
    void task;
  }
}
