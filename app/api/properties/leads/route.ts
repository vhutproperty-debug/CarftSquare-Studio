import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { INDIAN_MOBILE_ERROR, isValidIndianMobile, normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import {
  PROPERTIES_DUPLICATE_WINDOW_MINUTES,
  PROPERTIES_LEADS_COLLECTION,
  PROPERTIES_OPS_SOURCE,
  PROPERTIES_RATE_LIMIT_MAX_PER_IP,
  PROPERTIES_RATE_LIMIT_WINDOW_MINUTES,
  PROPERTIES_SUCCESS_MESSAGE,
} from '@/lib/properties/constants';
import { propertiesLeadSubmitSchema } from '@/lib/properties/schemas';
import { getRequestIp, getRequestUserAgent } from '@/lib/properties/request';
import {
  countRecentPropertiesLeadsByIp,
  createPropertiesLead,
  ensurePropertiesLeadIndexes,
  findRecentPropertiesLeadByMobile,
} from '@/lib/properties/store';

export const dynamic = 'force-dynamic';

/** Reject cross-site browser posts. Requests without an Origin header (curl, server) pass. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    return !host || originHost === host;
  } catch {
    return false;
  }
}

function firstIssueMessage(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message || 'Please check the form and try again.';
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Origin not allowed.' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    // Honeypot: pretend success so bots learn nothing, store nothing.
    if (body && typeof body === 'object' && String((body as Record<string, unknown>).companyWebsite || '').trim()) {
      return NextResponse.json({ success: true, message: PROPERTIES_SUCCESS_MESSAGE }, { status: 201 });
    }

    const parsed = propertiesLeadSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: firstIssueMessage(parsed.error), fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const data = parsed.data;

    if (!isValidIndianMobile(data.mobile)) {
      return NextResponse.json({ error: INDIAN_MOBILE_ERROR, fieldErrors: { mobile: [INDIAN_MOBILE_ERROR] } }, { status: 400 });
    }
    const mobile = normalizeIndianMobile(data.mobile);
    const ip = getRequestIp(request);
    const userAgent = getRequestUserAgent(request);

    const db = await getDb();
    await ensurePropertiesLeadIndexes(db);

    const recentFromIp = await countRecentPropertiesLeadsByIp(db, ip, PROPERTIES_RATE_LIMIT_WINDOW_MINUTES);
    if (recentFromIp >= PROPERTIES_RATE_LIMIT_MAX_PER_IP) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again in a few minutes or WhatsApp us.' },
        { status: 429 },
      );
    }

    const duplicate = await findRecentPropertiesLeadByMobile(db, mobile, PROPERTIES_DUPLICATE_WINDOW_MINUTES);
    if (duplicate) {
      return NextResponse.json({ success: true, duplicate: true, message: PROPERTIES_SUCCESS_MESSAGE, lead: { id: duplicate.id } });
    }

    const lead = await createPropertiesLead(db, {
      name: data.name,
      mobile,
      email: data.email,
      intent: data.intent,
      area: data.area,
      budget: data.budget,
      message: data.message,
      pagePath: data.pagePath,
      referrer: data.referrer,
      utm: data.utm,
      ip,
      userAgent,
    });

    try {
      const { notifyNewWebsiteLead } = await import('@/lib/leads/notify');
      notifyNewWebsiteLead({
        id: lead.id,
        source: PROPERTIES_OPS_SOURCE,
        name: lead.name,
        phone: lead.mobile,
        email: lead.email,
        project: `CraftSquare Properties - ${lead.intentLabel || lead.intent}`,
        collection: PROPERTIES_LEADS_COLLECTION,
      });
    } catch (notifyError) {
      console.warn('[properties] notify_failed', notifyError instanceof Error ? notifyError.message : notifyError);
    }

    return NextResponse.json(
      { success: true, message: PROPERTIES_SUCCESS_MESSAGE, lead: { id: lead.id } },
      { status: 201 },
    );
  } catch (error) {
    console.error('[properties] lead_submit_failed', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Submission failed. Please try again or WhatsApp us.' }, { status: 500 });
  }
}
