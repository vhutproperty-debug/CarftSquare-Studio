/** Safe same-origin return path for /ops after admin login. */
export function isSafeOpsReturnTo(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith('/ops')) return false;
  if (value.startsWith('//')) return false;
  if (value.includes('://')) return false;
  if (value.includes('\\') || value.includes('..')) return false;
  if (value.includes('\n') || value.includes('\r')) return false;
  return true;
}
