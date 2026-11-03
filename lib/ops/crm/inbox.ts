export type InboxSource = 'requirement' | 'demand' | 'whatsapp';

export type InboxItem = {
  source: InboxSource;
  sourceId: string;
  title: string;
  at: string;
  assignedTo: string;
};

export type InboxInput = {
  requirements?: Array<{ id: string; title: string; at?: string; assignedTo?: string }>;
  demands?: Array<{ id: string; title: string; at?: string; assignedTo?: string }>;
  conversations?: Array<{ id: string; title: string; at?: string; assignedTo?: string }>;
};

/** One row per source record. Sources stay separate; nothing is merged into a new lead. */
export function buildInbox(input: InboxInput): InboxItem[] {
  const items: InboxItem[] = [];
  for (const row of input.requirements || []) {
    items.push({ source: 'requirement', sourceId: row.id, title: row.title, at: row.at || '', assignedTo: row.assignedTo || '' });
  }
  for (const row of input.demands || []) {
    items.push({ source: 'demand', sourceId: row.id, title: row.title, at: row.at || '', assignedTo: row.assignedTo || '' });
  }
  for (const row of input.conversations || []) {
    items.push({ source: 'whatsapp', sourceId: row.id, title: row.title, at: row.at || '', assignedTo: row.assignedTo || '' });
  }
  return items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
