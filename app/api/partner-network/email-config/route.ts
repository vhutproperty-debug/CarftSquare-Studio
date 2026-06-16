import { NextResponse } from 'next/server';
import { validateResendConfig } from '@/lib/env/resend';

export const dynamic = 'force-dynamic';

/** Safe runtime check — no secrets exposed. Use after Vercel env changes + redeploy. */
export async function GET() {
  const validation = validateResendConfig();
  return NextResponse.json({
    emailConfigured: validation.ok,
    missing: validation.missing,
    warnings: validation.warnings,
    runtime: validation.runtime,
    emailFromSource: validation.emailFromSource,
    apiKeySource: validation.apiKeySource ? 'set' : null,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
