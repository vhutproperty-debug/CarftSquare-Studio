/**
 * Visual QA — Partner Registration form labels & structure (source-level).
 * Usage: node scripts/verify-partner-form-labels.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const formPath = resolve('components/partner-network/PartnerRegistrationForm.jsx');
const cssPath = resolve('components/partner-network/partner-registration-form.css');
const formSrc = readFileSync(formPath, 'utf8');
const cssSrc = readFileSync(cssPath, 'utf8');

const REQUIRED_LABELS = [
  'Full Name',
  'Mobile',
  'Email',
  'Company Name',
  'Operating Areas',
  'Projects Covered',
  'Rental / Sales / Both',
  'Deals Per Month',
  'WhatsApp',
  'RERA Number',
  'City',
  'State',
];

const checks = [];

function test(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
}

for (const label of REQUIRED_LABELS) {
  test(`Label present: ${label}`, formSrc.includes(`label="${label}"`) || formSrc.includes(`label='${label}'`));
}

test('Uses native label elements', formSrc.includes('<label htmlFor'));
test('No Radix Label import', !formSrc.includes("from '@/components/ui/label'"));
test('No collapsible hiding fields', !formSrc.includes('Collapsible'));
test('No overflow-hidden on form groups', !formSrc.includes('overflow-hidden'));
test('No parent bg opacity classes on groups', !formSrc.includes('bg-slate-900/40') && !formSrc.includes('bg-slate-900/50'));
test('No backdrop-blur on form CTA bar', !formSrc.includes('backdrop-blur-md'));
test('Uses partner-reg-card glass shell', cssSrc.includes('rgba(17, 24, 39, 0.75)'));
test('Inner groups solid background', cssSrc.includes('background: #111827 !important'));
test('Form opacity forced to 1', cssSrc.includes('.partner-reg-form') && cssSrc.includes('opacity: 1 !important'));
test('CSS: label display block', cssSrc.includes('display: block !important'));
test('CSS: label color #ffffff', cssSrc.includes('color: #ffffff !important'));
test('CSS: label margin-bottom 6px', cssSrc.includes('margin-bottom: 6px !important'));
test('CSS: label position static', cssSrc.includes('position: static !important'));
test('CSS: input height 48px', cssSrc.includes('height: 48px !important'));
test('CSS: placeholder visible', cssSrc.includes('#9ca3af !important'));
test('CSS: group overflow visible', cssSrc.includes('overflow: visible !important'));
test('CSS: no absolute label positioning', !cssSrc.match(/\.partner-reg-label[\s\S]*position:\s*absolute/));

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
process.exit(failed.length ? 1 : 0);
