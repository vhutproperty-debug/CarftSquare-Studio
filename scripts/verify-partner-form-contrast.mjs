/**
 * WCAG AA contrast check for Partner Registration form tokens.
 * Usage: node scripts/verify-partner-form-contrast.mjs
 */
function luminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrast(hex1, hex2) {
  const parse = (h) => {
    const n = h.replace('#', '');
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
  };
  const l1 = luminance(...parse(hex1));
  const l2 = luminance(...parse(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const BG = '#0f172a'; // slate-900 input bg
const PAGE = '#020617'; // slate-950 page

const pairs = [
  ['Label white on page', '#FFFFFF', PAGE],
  ['Label gray on page', '#E5E7EB', PAGE],
  ['Input text on field bg', '#FFFFFF', BG],
  ['Placeholder on field bg', '#9CA3AF', BG],
  ['Checkbox label on page', '#E5E7EB', PAGE],
  ['Section subtitle', '#9CA3AF', PAGE],
];

const results = pairs.map(([name, fg, bg]) => {
  const ratio = contrast(fg, bg);
  return { name, fg, bg, ratio: Number(ratio.toFixed(2)), aa: ratio >= 4.5, aaa: ratio >= 7 };
});

const failed = results.filter((r) => !r.aa);
console.log(JSON.stringify({ passed: results.length - failed.length, failed: failed.length, results }, null, 2));
process.exit(failed.length ? 1 : 0);
