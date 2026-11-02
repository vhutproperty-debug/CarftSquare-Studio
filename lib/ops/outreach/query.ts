import type { OutreachContact, OutreachListQuery, OutreachStatus } from '@/lib/ops/outreach/types';
import { OUTREACH_STATUSES } from '@/lib/ops/outreach/types';

export function filterOutreach(contacts: OutreachContact[], query: OutreachListQuery): OutreachContact[] {
  return contacts.filter((contact) => {
    if (query.audience && contact.audience !== query.audience) return false;
    if (query.wave && contact.wave !== query.wave) return false;
    if (query.project && contact.project !== query.project) return false;
    if (query.tower && contact.tower !== query.tower) return false;
    if (query.status && contact.status !== query.status) return false;
    if (query.q) {
      const hay = [contact.name, contact.project, contact.tower, contact.phone_e164, contact.email, contact.flats.join(' ')].join(' ').toLowerCase();
      if (!hay.includes(query.q.trim().toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function statusCounts(contacts: OutreachContact[]): Record<OutreachStatus, number> {
  const counts = Object.fromEntries(OUTREACH_STATUSES.map((status) => [status, 0])) as Record<OutreachStatus, number>;
  contacts.forEach((contact) => { counts[contact.status] += 1; });
  return counts;
}

export function outreachOptions(contacts: OutreachContact[]) {
  const values = (pick: (contact: OutreachContact) => string) => [...new Set(contacts.map(pick).map((item) => item.trim()).filter(Boolean))].sort();
  return { waves: values((contact) => contact.wave), projects: values((contact) => contact.project), towers: values((contact) => contact.tower) };
}
