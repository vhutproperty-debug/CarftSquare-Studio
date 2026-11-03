export type LeadgenNotice = {
  leadgenId: string;
  formId: string;
  adId: string;
  pageId: string;
  createdTime: string;
};

export type WhatsAppEnquiry = {
  externalId: string;
  phone: string;
  name: string;
  message: string;
  at: string;
};

type LeadgenChange = {
  field?: string;
  value?: { leadgen_id?: string; form_id?: string; ad_id?: string; page_id?: string; created_time?: number };
};

export function extractLeadgenNotices(body: unknown): LeadgenNotice[] {
  const root = body as { entry?: Array<{ id?: string; changes?: LeadgenChange[] }> } | null;
  const notices: LeadgenNotice[] = [];
  for (const entry of root?.entry || []) {
    for (const change of entry.changes || []) {
      const leadgenId = String(change.value?.leadgen_id || '').trim();
      if (change.field !== 'leadgen' || !leadgenId) continue;
      const created = change.value?.created_time;
      notices.push({
        leadgenId,
        formId: String(change.value?.form_id || ''),
        adId: String(change.value?.ad_id || ''),
        pageId: String(change.value?.page_id || entry.id || ''),
        createdTime: created ? new Date(created * 1000).toISOString() : '',
      });
    }
  }
  return notices;
}

type WaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
};

export function extractWhatsAppEnquiries(body: unknown): WhatsAppEnquiry[] {
  const root = body as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: WaMessage[];
        };
      }>;
    }>;
  } | null;
  const enquiries: WhatsAppEnquiry[] = [];
  for (const entry of root?.entry || []) {
    for (const change of entry.changes || []) {
      const contacts = change.value?.contacts || [];
      for (const message of change.value?.messages || []) {
        const externalId = String(message.id || '').trim();
        if (!externalId || message.type === 'system') continue;
        const phone = String(message.from || '');
        const contact = contacts.find((row) => row.wa_id === phone);
        const at = message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : '';
        enquiries.push({
          externalId,
          phone,
          name: contact?.profile?.name || '',
          message: message.text?.body || '',
          at,
        });
      }
    }
  }
  return enquiries;
}

export function leadsRetrievalGranted(permissions: string[]): boolean {
  return permissions.includes('leads_retrieval');
}

export function whatsAppCaptureAllowed(restricted: boolean): { allowed: boolean; reason: string } {
  if (restricted) {
    return { allowed: false, reason: 'WhatsApp capture is paused because the WABA is restricted.' };
  }
  return { allowed: true, reason: '' };
}
