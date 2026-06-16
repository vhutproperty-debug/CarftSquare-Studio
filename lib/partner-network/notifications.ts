import { BRAND } from '@/lib/brand';
import { assertResendConfigured, getResendApiKey, resolveEmailFrom } from '@/lib/env/resend';

export type NotificationChannel = 'email' | 'whatsapp' | 'sms' | 'push' | 'admin_alert' | 'partner_alert';

export type NotificationPayload = {
  channel: NotificationChannel;
  to: string;
  template: string;
  data?: Record<string, unknown>;
  subject?: string;
};

function maskAddress(value: string) {
  if (!value) return '';
  if (value.includes('@')) {
    const [user, domain] = value.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `***${value.slice(-4)}`;
}

function isValidEmail(value: string | undefined) {
  return Boolean(value && value.includes('@') && value.includes('.'));
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ');
}

function buildEmailHtml(template: string, data: Record<string, unknown> = {}) {
  const siteUrl = `https://${BRAND.domain}`;
  const wrap = (title: string, body: string) => `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
      <p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${BRAND.name}</p>
      <h1 style="font-size:22px;margin:0 0 16px;">${title}</h1>
      ${body}
      <p style="margin-top:24px;font-size:13px;color:#64748b;">
        <a href="${siteUrl}/partner" style="color:#ea580c;">Partner Network</a> · ${BRAND.phone}
      </p>
    </div>
  `;

  switch (template) {
    case 'partner_approved':
      return wrap('Your partner account is approved', `
        <p>Hi ${data.fullName || 'Partner'},</p>
        <p>Your CraftSquare Partner Network application (<strong>${data.partnerId}</strong>) has been approved.</p>
        <p>You can now log in at <a href="${siteUrl}/partner/login">${siteUrl}/partner/login</a> using the OTP sent to your registered email.</p>
      `);
    case 'partner_rejected':
      return wrap('Partner application update', `
        <p>Hi ${data.fullName || 'Partner'},</p>
        <p>Your partner application (<strong>${data.partnerId}</strong>) was not approved at this time.</p>
        <p>If you have questions, contact us at ${BRAND.emailTo}.</p>
      `);
    case 'lead_status_update':
      return wrap('Lead status updated', `
        <p>Hi ${data.fullName || 'Partner'},</p>
        <p>Lead <strong>${data.leadId}</strong>${data.clientName ? ` (${data.clientName})` : ''} is now: <strong>${formatStatus(String(data.status || ''))}</strong>.</p>
        <p>Track progress in your <a href="${siteUrl}/partner/dashboard">partner dashboard</a>.</p>
      `);
    case 'new_partner_registration':
      return wrap('New partner registration', `
        <p>A new partner registered in the Partner Network CRM.</p>
        <p><strong>${data.fullName}</strong> · ${data.partnerId}</p>
        <p><a href="${siteUrl}/admin/partner-network">Review in Partner CRM</a></p>
      `);
    default:
      return wrap('CraftSquare Partner Network', `<pre style="white-space:pre-wrap;font-size:13px;">${JSON.stringify(data, null, 2)}</pre>`);
  }
}

function defaultSubject(template: string) {
  const subjects: Record<string, string> = {
    partner_approved: 'CraftSquare Partner Approved',
    partner_rejected: 'CraftSquare Partner Application Update',
    lead_status_update: 'CraftSquare Partner Lead Update',
    new_partner_registration: 'New CraftSquare Partner Registration',
  };
  return subjects[template] || 'CraftSquare Partner Network';
}

async function sendResendEmail(to: string, subject: string, html: string) {
  assertResendConfigured();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getResendApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resolveEmailFrom(),
      to: [to],
      subject,
      html,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((result as { message?: string; error?: string })?.message
      || (result as { error?: string })?.error
      || `Resend API failed with ${response.status}`);
  }

  return { delivered: true, id: (result as { id?: string })?.id };
}

/** Notification dispatcher — Resend for email; partner OTP SMS via lib/partner-network/sms.ts. */
export async function sendNotification(
  payload: NotificationPayload,
): Promise<{ queued: boolean; delivered?: boolean; channel: NotificationChannel }> {
  const subject = payload.subject || defaultSubject(payload.template);
  const html = buildEmailHtml(payload.template, payload.data);
  const data = payload.data || {};

  if (payload.channel === 'email' || payload.channel === 'admin_alert') {
    const to = payload.channel === 'admin_alert'
      ? (process.env.EMAIL_TO || BRAND.emailTo)
      : payload.to;

    if (!isValidEmail(to)) {
      console.info('[partner-notification] email skipped (invalid address)', { template: payload.template, to: maskAddress(to) });
      return { queued: false, delivered: false, channel: payload.channel };
    }

    try {
      const result = await sendResendEmail(to, subject, html);
      console.info('[partner-notification] email sent', { template: payload.template, to: maskAddress(to), delivered: result.delivered });
      return { queued: true, delivered: result.delivered, channel: payload.channel };
    } catch (error) {
      console.error('[partner-notification] email failed', {
        template: payload.template,
        to: maskAddress(to),
        error: error instanceof Error ? error.message : error,
      });
      return { queued: true, delivered: false, channel: payload.channel };
    }
  }

  if (payload.channel === 'sms') {
    console.info('[partner-notification] sms channel handled by lib/partner-network/sms.ts', {
      template: payload.template,
      to: maskAddress(payload.to),
    });
    return { queued: false, delivered: false, channel: payload.channel };
  }

  if (payload.channel === 'partner_alert' || payload.channel === 'whatsapp') {
    const partnerEmail = typeof data.email === 'string' ? data.email : '';
    let delivered = false;

    if (isValidEmail(partnerEmail)) {
      try {
        const result = await sendResendEmail(partnerEmail, subject, html);
        delivered = Boolean(result.delivered);
      } catch (error) {
        console.error('[partner-notification] partner email failed', {
          template: payload.template,
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    console.info('[partner-notification] partner alert queued', {
      channel: payload.channel,
      template: payload.template,
      to: maskAddress(payload.to),
      emailFallback: delivered,
    });

    return { queued: true, delivered, channel: payload.channel };
  }

  console.info('[partner-notification] unhandled channel', payload.channel);
  return { queued: false, channel: payload.channel };
}

export async function notifyPartnerApproved(partner: {
  email: string;
  mobile: string;
  partnerId: string;
  fullName: string;
}) {
  const tasks: Promise<unknown>[] = [];

  if (isValidEmail(partner.email)) {
    tasks.push(sendNotification({
      channel: 'email',
      to: partner.email,
      template: 'partner_approved',
      data: partner,
      subject: 'CraftSquare Partner Approved',
    }));
  }

  tasks.push(sendNotification({
    channel: 'partner_alert',
    to: partner.mobile,
    template: 'partner_approved',
    data: partner,
    subject: 'CraftSquare Partner Approved',
  }));

  await Promise.all(tasks);
}

export async function notifyPartnerRejected(partner: {
  email: string;
  mobile: string;
  partnerId: string;
  fullName: string;
}) {
  const tasks: Promise<unknown>[] = [];

  if (isValidEmail(partner.email)) {
    tasks.push(sendNotification({
      channel: 'email',
      to: partner.email,
      template: 'partner_rejected',
      data: partner,
      subject: 'CraftSquare Partner Application Update',
    }));
  }

  tasks.push(sendNotification({
    channel: 'partner_alert',
    to: partner.mobile,
    template: 'partner_rejected',
    data: partner,
    subject: 'CraftSquare Partner Application Update',
  }));

  await Promise.all(tasks);
}

export async function notifyAdminNewPartner(partner: { partnerId: string; fullName: string }) {
  await sendNotification({
    channel: 'admin_alert',
    to: process.env.EMAIL_TO || BRAND.emailTo,
    template: 'new_partner_registration',
    data: partner,
    subject: 'New Partner Registration',
  });
}

export async function notifyLeadStatusChange(
  lead: { leadId: string; status: string; clientName?: string },
  partner: { mobile: string; email?: string; fullName?: string },
) {
  const data = { ...lead, ...partner };

  await sendNotification({
    channel: 'partner_alert',
    to: partner.mobile,
    template: 'lead_status_update',
    data,
    subject: `Lead ${lead.leadId} → ${formatStatus(lead.status)}`,
  });
}
