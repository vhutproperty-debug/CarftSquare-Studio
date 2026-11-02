import type { OutreachContact } from '@/lib/ops/outreach/types';

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || '';
}

export function renderOutreachTemplate(body: string, contact: Pick<OutreachContact, 'name' | 'project' | 'tower'>): string {
  return body
    .split('{first_name}').join(firstName(contact.name))
    .split('{project}').join(contact.project)
    .split('{tower}').join(contact.tower);
}

export function outreachMessage(contact: OutreachContact, templateBody: string): string {
  const custom = contact.message.trim();
  if (custom) return renderOutreachTemplate(custom, contact);
  return renderOutreachTemplate(templateBody, contact);
}
