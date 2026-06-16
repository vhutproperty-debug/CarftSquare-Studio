/**
 * Partner Network OTP SMS delivery (MSG91 primary, Twilio optional fallback).
 * Configure via environment variables only — no hardcoded secrets.
 */

export type SmsProvider = 'msg91' | 'twilio' | 'none';

export type SmsDeliveryResult = {
  delivered: boolean;
  provider: SmsProvider;
  reason?: string;
};

function maskMobile(mobile: string) {
  const digits = String(mobile).replace(/\D/g, '');
  return digits ? `***${digits.slice(-4)}` : '***';
}

export function normalizeSmsMobile(mobile: string) {
  const digits = String(mobile).replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return digits;
  return `91${digits}`;
}

function resolveProvider(): SmsProvider {
  const preferred = String(process.env.SMS_PROVIDER || 'msg91').trim().toLowerCase();

  const twilioReady = Boolean(
    process.env.TWILIO_ACCOUNT_SID
    && process.env.TWILIO_AUTH_TOKEN
    && process.env.TWILIO_SMS_FROM,
  );
  const msg91Ready = Boolean(process.env.MSG91_AUTH_KEY);

  if (preferred === 'twilio' && twilioReady) return 'twilio';
  if (preferred === 'msg91' && msg91Ready) return 'msg91';
  if (msg91Ready) return 'msg91';
  if (twilioReady) return 'twilio';
  return 'none';
}

export function getSmsConfigStatus() {
  const provider = resolveProvider();
  return {
    provider,
    configured: provider !== 'none',
    smsProviderEnv: process.env.SMS_PROVIDER || 'msg91 (default)',
    msg91AuthKey: Boolean(process.env.MSG91_AUTH_KEY),
    msg91OtpTemplateId: Boolean(process.env.MSG91_OTP_TEMPLATE_ID),
    msg91SenderId: Boolean(process.env.MSG91_SENDER_ID),
    twilioAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
    twilioAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
    twilioSmsFrom: Boolean(process.env.TWILIO_SMS_FROM),
  };
}

async function sendViaMsg91(mobile: string, otp: string): Promise<SmsDeliveryResult> {
  const authKey = process.env.MSG91_AUTH_KEY;
  if (!authKey) {
    return { delivered: false, provider: 'msg91', reason: 'missing_MSG91_AUTH_KEY' };
  }

  const normalized = normalizeSmsMobile(mobile);
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;

  if (templateId) {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', templateId);
    url.searchParams.set('mobile', normalized);
    url.searchParams.set('authkey', authKey);
    url.searchParams.set('otp', otp);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = await response.json().catch(() => ({}));
    const message = (result as { message?: string })?.message;
    const isError = (result as { type?: string })?.type === 'error' || !response.ok;

    if (isError) {
      throw new Error(message || `MSG91 OTP API failed (${response.status})`);
    }

    console.info('[partner-otp-sms] msg91 otp sent', { mobile: maskMobile(mobile), templateId: 'configured' });
    return { delivered: true, provider: 'msg91' };
  }

  const sender = process.env.MSG91_SENDER_ID;
  if (!sender) {
    return {
      delivered: false,
      provider: 'msg91',
      reason: 'missing_MSG91_OTP_TEMPLATE_ID_or_MSG91_SENDER_ID',
    };
  }

  const message = `Your CraftSquare Partner login OTP is ${otp}. Valid for 10 minutes. Do not share it.`;
  const params = new URLSearchParams({
    authkey: authKey,
    mobiles: normalized,
    message,
    sender,
    route: process.env.MSG91_ROUTE || '4',
    country: '91',
  });

  const response = await fetch(`https://api.msg91.com/api/sendhttp.php?${params.toString()}`);
  const body = await response.text();
  if (!response.ok || /^error/i.test(body.trim())) {
    throw new Error(`MSG91 transactional SMS failed (${response.status})`);
  }

  console.info('[partner-otp-sms] msg91 transactional sent', { mobile: maskMobile(mobile), sender });
  return { delivered: true, provider: 'msg91' };
}

async function sendViaTwilio(mobile: string, otp: string): Promise<SmsDeliveryResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_SMS_FROM;

  if (!sid || !token || !from) {
    return { delivered: false, provider: 'twilio', reason: 'missing_twilio_config' };
  }

  const to = `+${normalizeSmsMobile(mobile)}`;
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: from,
      Body: `Your CraftSquare Partner login OTP is ${otp}. Valid for 10 minutes.`,
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((result as { message?: string })?.message || `Twilio SMS failed (${response.status})`);
  }

  console.info('[partner-otp-sms] twilio sent', { mobile: maskMobile(mobile) });
  return { delivered: true, provider: 'twilio' };
}

export async function sendPartnerOtpSms(mobile: string, otp: string): Promise<SmsDeliveryResult> {
  const provider = resolveProvider();
  if (provider === 'none') {
    return { delivered: false, provider: 'none', reason: 'sms_not_configured' };
  }

  if (provider === 'twilio') {
    return sendViaTwilio(mobile, otp);
  }
  return sendViaMsg91(mobile, otp);
}

export { maskMobile as maskSmsMobile };
