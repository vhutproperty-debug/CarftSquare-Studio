import { NextResponse } from 'next/server';
import { validateResendConfig } from '@/lib/env/resend';

export const dynamic = 'force-dynamic';

/** Safe runtime check — no secrets exposed. Use after Vercel env changes + redeploy. */
export async function GET() {
  const validation = validateResendConfig();
  return NextResponse.json({
    emailConfigured: validation.ok,
    missing: validation.missing,
    runtime: validation.runtime,
    resendApiKeySet: Boolean(process.env.RESEND_API_KEY?.trim()),
    emailFromSet: Boolean(process.env.EMAIL_FROM?.trim()),
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
