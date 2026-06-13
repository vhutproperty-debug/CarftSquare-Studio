const WORDS_PER_MINUTE = 200;

export function estimateReadingTimeMinutes(content = '', fallback = 1): number {
  const text = String(content)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return fallback;
  const words = text.split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}
