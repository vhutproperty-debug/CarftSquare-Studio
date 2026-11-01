export type ProspectVariableField = 'salutation' | 'units';

const CORPORATE_FIRST = /^(team|huf|ltd|pvt|private|limited|m\/s|ms)$/i;

function templateParam(value: string, fallback: string): string {
  const cleaned = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return (cleaned || fallback).slice(0, 200);
}

export function salutationForTemplate(prospect: {
  salutation?: string | null;
  name?: string | null;
}): string {
  const explicit = prospect.salutation?.trim();
  if (explicit) return templateParam(explicit, 'there');
  const name = prospect.name?.trim();
  if (!name) return 'there';
  const first = name.split(/\s+/)[0] || '';
  if (!first || CORPORATE_FIRST.test(first)) return 'there';
  return templateParam(first, 'there');
}

/** "506, 3105" → "506 & 3105" so template {{2}} reads as unit(s). */
export function formatUnitsForTemplate(
  unit?: string | null,
  unitCount?: number | null,
): string {
  const parts = String(unit || '')
    .split(/[,&/|;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length) return templateParam(parts.join(' & '), 'your flat');
  if (typeof unitCount === 'number' && unitCount > 0) {
    return unitCount === 1 ? '1 unit' : `${unitCount} units`;
  }
  return 'your flat';
}

export function renderProspectBodyValues(
  prospect: {
    salutation?: string | null;
    name?: string | null;
    unit?: string | null;
    unitCount?: number | null;
  },
  fields: ProspectVariableField[] = ['salutation', 'units'],
): string[] {
  return fields.map((field) => (
    field === 'salutation'
      ? salutationForTemplate(prospect)
      : formatUnitsForTemplate(prospect.unit, prospect.unitCount)
  ));
}
