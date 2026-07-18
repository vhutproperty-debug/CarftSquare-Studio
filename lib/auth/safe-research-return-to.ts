/** Safe same-origin return path for /research after admin login. */
export function isSafeResearchReturnTo(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith('/research')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('://')) return false;
  if (value.includes('\\') || value.includes('..')) return false;
  if (value.includes('\n') || value.includes('\r')) return false;
  return true;
}

/** Safe return paths for shared admin login across CraftSquare apps. */
export function isSafeAdminReturnTo(value: string | null | undefined): value is string {
  if (!value) return false;
  if (value.startsWith('/ops')) {
    if (value.startsWith('//')) return false;
    if (value.includes('://')) return false;
    if (value.includes('\\') || value.includes('..')) return false;
    if (value.includes('\n') || value.includes('\r')) return false;
    return true;
  }
  return isSafeResearchReturnTo(value);
}
