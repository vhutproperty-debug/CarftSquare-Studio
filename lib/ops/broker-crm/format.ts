export function formatBrokerPhone(phone: string): string {
  if (/^[6-9]\d{9}$/.test(phone)) {
    return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
}

/** Calendar date in Mumbai, where the brokerage operates. */
export function mumbaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}
