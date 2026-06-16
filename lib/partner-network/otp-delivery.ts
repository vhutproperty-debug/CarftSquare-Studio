import { BRAND } from '@/lib/brand';

export type OtpDeliveryResult = {
  email: { delivered: boolean; reason?: string; id?: string };
  whatsapp: { delivered: boolean; reason?: string };
};

function maskEmail(email: string) {
  if (!email || !email.includes('@')) return '***';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 2)}***@${domain}`;
}

function maskMobile(mobile: string) {
  const digits = String(mobile).replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : '***';
}

function normalizeWhatsAppRecipient(mobile: string) {
  const digits = String(mobile).replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `91${digits}` : digits;
}

export const DEFAULT_EMAIL_FROM = 'CraftSquare Studio <notifications@craftsquare.co.in>';

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/** Resolve sender from EMAIL_FROM env, with production default when unset. */
export function resolveEmailFrom(): string {
  const raw = String(process.env.EMAIL_FROM || DEFAULT_EMAIL_FROM).trim();

  if (raw.includes('@')) {
    return raw;
  }

  const domain = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
  if (!domain.includes('.')) {
    throw new Error(
      'EMAIL_FROM must be a verified sender address (e.g. CraftSquare Studio <notifications@craftsquare.co.in>).',
    );
  }

  return `${BRAND.name} <notifications@${domain}>`;
}

export function getOtpDeliveryConfig() {
  const resend = isResendConfigured();
  const whatsapp = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
  return {
    emailProvider: resend ? 'resend' : 'none',
    whatsappProvider: whatsapp ? 'meta_whatsapp' : 'none',
    emailConfigured: resend,
    whatsappConfigured: whatsapp,
  };
}

function formatResendError(result: unknown, status: number) {
  if (result && typeof result === 'object') {
    const payload = result as { message?: string; error?: string; name?: string };
    if (payload.message) return payload.message;
    if (payload.error) return payload.error;
    if (payload.name) return payload.name;
  }
  return `Resend API failed (${status})`;
}

async function sendOtpEmail(to: string, otp: string, fullName: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { delivered: false, reason: 'missing_RESEND_API_KEY' };
  }

  const from = resolveEmailFrom();
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a;">
      <p style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${BRAND.name}</p>
      <h1 style="font-size:22px;margin:0 0 16px;">Partner Login OTP</h1>
      <p>Hi ${fullName || 'Partner'},</p>
      <p>Your one-time login code is:</p>
      <p style="font-size:32px;font-weight:800;letter-spacing:0.3em;color:#ea580c;">${otp}</p>
      <p style="color:#64748b;font-size:14px;">Valid for 5 minutes. Do not share this code with anyone.</p>
      <p style="color:#64748b;font-size:13px;">If you did not request this, you can ignore this email.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `${BRAND.name} Partner Login Code`,
      html,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(formatResendError(result, response.status));
  }

  const id = (result as { id?: string })?.id;
  console.info('[partner-otp] email sent via Resend', { to: maskEmail(to), id });
  return { delivered: true, id };
}

async function sendOtpWhatsApp(toMobile: string, otp: string, fullName: string) {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneId || !token) {
    return { delivered: false, reason: 'whatsapp_not_configured' };
  }

  const to = normalizeWhatsAppRecipient(toMobile);
  const message = `Hi ${fullName || 'Partner'}, your ${BRAND.name} partner login OTP is ${otp}. Valid for 5 minutes. Do not share this code.`;

  const response = await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((result as { error?: { message?: string } })?.error?.message || `WhatsApp API failed (${response.status})`);
  }

  console.info('[partner-otp] whatsapp sent', { to: maskMobile(toMobile) });
  return { delivered: true };
}

export async function dispatchPartnerOtp(
  partner: { email: string; mobile: string; whatsapp?: string; fullName: string },
  otp: string,
): Promise<OtpDeliveryResult & { devLogged?: boolean }> {
  const config = getOtpDeliveryConfig();
  const result: OtpDeliveryResult = {
    email: { delivered: false },
    whatsapp: { delivered: false },
  };

  const email = String(partner.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Partner account has no registered email.');
  }

  if (config.emailConfigured) {
    result.email = await sendOtpEmail(email, otp, partner.fullName);
  } else if (process.env.NODE_ENV !== 'production') {
    console.info(`[partner-otp] dev fallback OTP for ${maskEmail(email)}: ${otp} (RESEND_API_KEY not set)`);
    result.email = { delivered: false, reason: 'dev_console_only' };
    return { ...result, devLogged: true };
  } else {
    throw new Error('Email provider is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }

  const whatsappTarget = partner.whatsapp || partner.mobile;
  if (config.whatsappConfigured && whatsappTarget) {
    try {
      result.whatsapp = await sendOtpWhatsApp(whatsappTarget, otp, partner.fullName);
    } catch (error) {
      console.error('[partner-otp] whatsapp delivery failed (non-blocking)', {
        to: maskMobile(whatsappTarget),
        error: error instanceof Error ? error.message : error,
      });
      result.whatsapp = { delivered: false, reason: 'whatsapp_send_failed' };
    }
  } else {
    result.whatsapp.reason = 'whatsapp_not_configured';
  }

  return result;
}
