export function canonicalKey(project: string, tower: string, flat: string): string {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
  return [norm(project), norm(tower), norm(flat)].filter(Boolean).join('|');
}

/** Adds candidate resale unit ids. Never removes a unit and never collapses two apartments. */
export function attachCandidateUnits(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming.map((id) => id.trim()).filter(Boolean)])];
}
