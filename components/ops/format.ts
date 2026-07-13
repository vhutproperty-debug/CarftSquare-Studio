export function formatOpsCurrency(value: number) {
  if (!value) return '₹0';
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatOpsDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
