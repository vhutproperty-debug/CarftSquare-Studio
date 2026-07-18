import { createHash } from 'crypto';
import type { ParsedWhatsAppMessage } from '@/lib/ops/brokers/types';

/**
 * WhatsApp .txt export parser (Android / iOS common formats).
 *
 * Formats handled:
 *   [DD/MM/YYYY, HH:MM:SS] Sender: message
 *   DD/MM/YYYY, HH:MM - Sender: message
 *   DD/MM/YYYY, HH:MM:SS am/pm - Sender: message
 *   [M/D/YY, H:MM:SS AM] Sender: message
 *
 * Multiline: continuation lines append to previous message body.
 */

const SYSTEM_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /created group/i,
  /added you/i,
  /left$/i,
  /removed\s+/i,
  /changed the (subject|group description|group icon)/i,
  /security code changed/i,
  /joined using this group's invite link/i,
  /you're now an admin/i,
  /missed (voice|video) call/i,
  /<media omitted>/i,
  /image omitted/i,
  /video omitted/i,
  /sticker omitted/i,
  /document omitted/i,
  /this message was deleted/i,
  /waiting for this message/i,
];

const HEADER_PATTERNS: RegExp[] = [
  // [DD/MM/YYYY, HH:MM:SS] Name: body  OR  [DD/MM/YYYY, HH:MM:SS AM/PM] Name: body
  /^\[(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]\s*([^:]+):\s([\s\S]*)$/,
  // DD/MM/YYYY, HH:MM - Name: body
  /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\s+[-–]\s+([^:]+):\s([\s\S]*)$/,
  // DD/MM/YYYY, HH:MM:SS: Name: body (rare)
  /^(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?):\s+([^:]+):\s([\s\S]*)$/,
];

export function hashMessage(parts: {
  groupName: string;
  senderName?: string;
  senderPhone?: string;
  messageTimestamp?: string;
  rawMessage: string;
}): string {
  const payload = [
    parts.groupName.trim().toLowerCase(),
    (parts.senderPhone || parts.senderName || '').trim().toLowerCase(),
    parts.messageTimestamp || '',
    parts.rawMessage.trim(),
  ].join('\n');
  return createHash('sha256').update(payload).digest('hex');
}

export function hashFileContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function extractSender(rawSender: string): { senderName?: string; senderPhone?: string } {
  const trimmed = rawSender.trim();
  if (!trimmed) return {};

  // +91 98765 43210 / 9876543210
  const phoneMatch = trimmed.match(/(\+?\d[\d\s\-()]{8,}\d)/);
  if (phoneMatch) {
    const digits = phoneMatch[1].replace(/\D/g, '');
    const phone = digits.length >= 10 ? digits.slice(-10) : undefined;
    const namePart = trimmed.replace(phoneMatch[0], '').replace(/[~\-]/g, '').trim();
    return {
      senderPhone: phone,
      senderName: namePart || undefined,
    };
  }

  return { senderName: trimmed };
}

function parseTimestamp(datePart: string, timePart: string): {
  messageDate?: string;
  messageTime?: string;
  messageTimestamp?: string;
} {
  const dateClean = datePart.trim();
  const timeClean = timePart.trim();
  const sep = dateClean.includes('-') ? '-' : dateClean.includes('.') ? '.' : '/';
  const [a, b, c] = dateClean.split(sep).map((x) => x.trim());
  if (!a || !b || !c) {
    return { messageDate: dateClean, messageTime: timeClean };
  }

  let day = Number(a);
  let month = Number(b);
  let year = Number(c);

  // US-style M/D/YY when first > 12 unlikely for day in IN exports — prefer DMY for WhatsApp India.
  if (year < 100) year += 2000;
  if (month > 12 && day <= 12) {
    const tmp = day;
    day = month;
    month = tmp;
  }

  const timeMatch = timeClean.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])?/);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (timeMatch) {
    hours = Number(timeMatch[1]);
    minutes = Number(timeMatch[2]);
    seconds = Number(timeMatch[3] || 0);
    const ampm = timeMatch[4]?.toLowerCase();
    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
  }

  const iso = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
  const messageDate = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  const messageTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}${
    seconds ? `:${String(seconds).padStart(2, '0')}` : ''
  }`;

  return {
    messageDate,
    messageTime,
    messageTimestamp: Number.isNaN(iso.getTime()) ? undefined : iso.toISOString(),
  };
}

function isSystemMessage(body: string, senderName?: string): boolean {
  const text = body.trim();
  if (!text) return true;
  if (senderName && /^(system|whatsapp)$/i.test(senderName)) return true;
  return SYSTEM_PATTERNS.some((re) => re.test(text));
}

function tryParseHeader(line: string): {
  datePart: string;
  timePart: string;
  senderRaw: string;
  body: string;
} | null {
  for (const re of HEADER_PATTERNS) {
    const m = line.match(re);
    if (m) {
      return {
        datePart: m[1],
        timePart: m[2],
        senderRaw: m[3],
        body: m[4] ?? '',
      };
    }
  }
  return null;
}

export function parseWhatsAppExport(content: string): {
  messages: ParsedWhatsAppMessage[];
  malformedLines: number;
} {
  const normalized = content.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  const messages: ParsedWhatsAppMessage[] = [];
  let current: ParsedWhatsAppMessage | null = null;
  let malformedLines = 0;

  function flush() {
    if (!current) return;
    current.rawMessage = current.rawMessage.replace(/\s+$/g, '').trim();
    if (!current.rawMessage && current.parseStatus !== 'SYSTEM') {
      current.parseStatus = 'SKIPPED';
    }
    messages.push(current);
    current = null;
  }

  for (const line of lines) {
    const header = tryParseHeader(line);
    if (header) {
      flush();
      const sender = extractSender(header.senderRaw);
      const ts = parseTimestamp(header.datePart, header.timePart);
      const system = isSystemMessage(header.body, sender.senderName);
      current = {
        ...sender,
        ...ts,
        rawMessage: header.body,
        parseStatus: system ? 'SYSTEM' : 'PARSED',
        isSystem: system,
      };
      continue;
    }

    // Continuation of multiline message
    if (current) {
      current.rawMessage += `\n${line}`;
      continue;
    }

    // Orphan line before any header
    if (line.trim()) {
      malformedLines += 1;
      messages.push({
        rawMessage: line,
        parseStatus: 'MALFORMED',
        isSystem: false,
      });
    }
  }

  flush();
  return { messages, malformedLines };
}
