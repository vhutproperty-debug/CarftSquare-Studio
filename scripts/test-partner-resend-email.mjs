/**
 * Sends a real Partner Network registration OTP via Resend.
 * Usage: node scripts/test-partner-resend-email.mjs [baseUrl] [recipientEmail]
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = process.argv[2] || 'http://localhost:3000';
const RECIPIENT = process.argv[3] || 'vhutproperty@gmail.com';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) {
        process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

function uniqueMobile() {
  return `9${String(Date.now()).slice(-9)}`;
}

async function main() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error('FAIL: RESEND_API_KEY is not set in .env.local');
    process.exit(1);
  }
  const emailFrom = process.env.EMAIL_FROM?.trim()
    || 'CraftSquare Studio <notifications@craftsquare.co.in>';

  const mobile = uniqueMobile();
  console.log('Registering test partner...');
  console.log(`  mobile: ${mobile}`);
  console.log(`  email:  ${RECIPIENT}`);
  console.log(`  from:   ${emailFrom}`);

  const res = await fetch(`${BASE}/api/partner-network/register/quick`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Resend OTP Test Partner',
      mobile,
      email: RECIPIENT,
      companyName: 'Resend QA',
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('FAIL: Registration API error', res.status, data);
    process.exit(1);
  }

  if (!data.emailDelivered && !data.devLogged) {
    console.error('FAIL: OTP email was not delivered via Resend', data);
    process.exit(1);
  }

  if (data.devLogged) {
    console.error('FAIL: Dev console fallback was used even though RESEND_API_KEY is set');
    process.exit(1);
  }

  console.log('PASS: Partner registration sent OTP via Resend');
  console.log(JSON.stringify({
    partnerId: data.partnerId,
    emailDelivered: data.emailDelivered,
    channels: data.channels,
    message: data.message,
  }, null, 2));
  console.log(`Check inbox for ${RECIPIENT} (subject: CraftSquare Studio Partner Login Code)`);
}

main().catch((error) => {
  console.error('FAIL:', error.message);
  process.exit(1);
});
