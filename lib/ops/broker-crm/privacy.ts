import { isPriorityBroker } from '@/lib/ops/broker-crm/priority';
import { brokerAreaLabels, brokerProjectLabels } from '@/lib/ops/broker-crm/tags';
import type { OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';

/**
 * Text that must never be shown to a broker or placed in an outreach file:
 * flat/unit numbers, owner details, prices, and commercial terms.
 * Internal ops notes are stored separately and are not passed through this check.
 */
const SENSITIVE_BROKER_TEXT = /\b(brokerage|commission|co[-\s]?brok\w*|landlord|owner|deposit)\b|\bsplit\b|50\s*[/–-]\s*50|₹|\b(?:rs\.?|inr)\s*\d|\b(?:flat|unit|wing)\b[^a-z0-9]{0,4}[a-z]?\d|\b[A-Za-z]{1,2}-\d{3,5}\b|\b\d+(?:\.\d+)?\s*(?:lakhs?|lacs?|crores?|cr)\b/i;

export function isSensitiveBrokerFacingText(value: string): boolean {
  return SENSITIVE_BROKER_TEXT.test(value || '');
}

export function assertBrokerFacingText(value: string, label: string): void {
  if (isSensitiveBrokerFacingText(value)) {
    throw new BrokerCrmPrivacyError(
      `${label} can't include flat numbers, owner details, prices, or brokerage.`,
    );
  }
}

export class BrokerCrmPrivacyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BrokerCrmPrivacyError';
  }
}

export function isDoNotContact(record: { status?: string; doNotContact?: boolean }): boolean {
  return record.status === 'do-not-contact' || record.doNotContact === true;
}

export type OutreachRecipient = {
  phone: string;
  name: string;
  groups: string;
  areas: string;
  projects: string;
  status: string;
  priorityScore: number;
  admin: 'yes' | 'no';
  groupCount: number;
};

const OUTREACH_KEYS: Array<keyof OutreachRecipient> = [
  'phone',
  'name',
  'groups',
  'areas',
  'projects',
  'status',
  'priorityScore',
  'admin',
  'groupCount',
];

function safeCell(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || isSensitiveBrokerFacingText(trimmed)) return '';
  return trimmed;
}

/** Contacts a future outreach send is allowed to use. Do-not-contact is omitted. */
export function selectOutreachRecipients(records: OpsBrokerCrmRecord[]): OutreachRecipient[] {
  return records
    .filter((record) => !isDoNotContact(record))
    .map((record) => ({
      phone: record.phone,
      name: safeCell(record.name) || 'Unnamed broker',
      groups: record.groups.map(safeCell).filter(Boolean).join('; '),
      areas: brokerAreaLabels(record).map(safeCell).filter(Boolean).join('; '),
      projects: brokerProjectLabels(record).map(safeCell).filter(Boolean).join('; '),
      status: record.status,
      priorityScore: record.priorityScore,
      admin: record.admin ? 'yes' as const : 'no' as const,
      groupCount: record.groupCount,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore || a.name.localeCompare(b.name));
}

function csvCell(value: string | number): string {
  const raw = String(value ?? '');
  const guarded = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

export function renderOutreachCsv(recipients: OutreachRecipient[]): string {
  const header = OUTREACH_KEYS.join(',');
  const lines = recipients.map((row) => OUTREACH_KEYS.map((key) => csvCell(row[key])).join(','));
  return `\uFEFF${[header, ...lines].join('\n')}\n`;
}

export function outreachCsvFor(records: OpsBrokerCrmRecord[]): string {
  return renderOutreachCsv(selectOutreachRecipients(records));
}

export function priorityCount(records: Array<{ groupCount: number; admin: boolean }>): number {
  return records.filter((record) => isPriorityBroker(record.groupCount, record.admin)).length;
}
