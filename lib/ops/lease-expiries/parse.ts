import { parseCsv } from '@/lib/ops/csv';
import { ProjectValidationError } from '@/lib/ops/projects/errors';

const ALIASES: Record<string, string> = {
  project: 'project',
  tower: 'tower',
  flat: 'flat',
  unit: 'flat',
  owner: 'ownerName',
  owner_name: 'ownerName',
  'owner name': 'ownerName',
  owner_phone: 'ownerPhone',
  'owner phone': 'ownerPhone',
  tenant: 'tenantName',
  tenant_name: 'tenantName',
  'tenant name': 'tenantName',
  tenant_phone: 'tenantPhone',
  'tenant phone': 'tenantPhone',
  lease_start: 'leaseStart',
  'lease start': 'leaseStart',
  start: 'leaseStart',
  lease_end: 'leaseEnd',
  'lease end': 'leaseEnd',
  end: 'leaseEnd',
  priority: 'priority',
  status: 'status',
  call_status: 'status',
  notes: 'notes',
};

export function parseLeaseCsv(text: string): Array<Record<string, string>> {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new ProjectValidationError('The CSV needs a header and at least one lease.');
  const headers = rows[0].map((header) => ALIASES[header.trim().toLowerCase()] || '');
  if (!headers.includes('project') || !headers.includes('flat')) {
    throw new ProjectValidationError('CSV needs project and flat columns.');
  }
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((key, index) => {
      if (key) record[key] = row[index] || '';
    });
    return record;
  }).filter((row) => row.project && row.flat);
}
