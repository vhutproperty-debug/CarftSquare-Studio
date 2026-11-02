export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `+${digits.slice(0, Math.min(2, digits.length - 4))} ••••${digits.slice(-4)}`;
}

export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '—';
  if (parts.length === 1) return `${parts[0].slice(0, 1)}•••`;
  return `${parts[0]} ${parts[parts.length - 1].slice(0, 1)}.`;
}
