export function formatIndianCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

export function formatBudgetRange(low: number, high: number): string {
  return `${formatIndianCurrency(low)} – ${formatIndianCurrency(high)}`;
}

export function parseArea(value: unknown, fallback = 650): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.max(parsed, 150), 20000);
}

export function cityToMultiplierId(city = 'Mumbai'): string {
  const map: Record<string, string> = {
    Mumbai: 'mumbai',
    'Navi Mumbai': 'navi-mumbai',
    Thane: 'thane',
    Pune: 'pune',
  };
  return map[city] || 'mumbai';
}

export function budgetToPackage(budget = ''): 'economy' | 'standard' | 'premium' | 'luxury' {
  const lower = budget.toLowerCase();
  if (lower.includes('40') || lower.includes('10l+') || lower.includes('₹10l+')) return 'luxury';
  if (lower.includes('25') || lower.includes('6l') || lower.includes('15')) return 'premium';
  if (lower.includes('8l') || lower.includes('3l') || lower.includes('under')) return 'economy';
  return 'standard';
}
