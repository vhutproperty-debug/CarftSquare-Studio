import type { Db } from 'mongodb';
import { getWhatsAppDefaultLanguage } from '@/lib/whatsapp-cloud/config';
import type { CloudTemplate } from '@/lib/whatsapp-cloud/client';

export const WA_TEMPLATES_COLLECTION = 'wa_templates';

export const TEMPLATE_NAMES = {
  leadWelcome: 'lead_welcome',
  leadFollowupDay1: 'lead_followup_day1',
  leadFollowupDay3: 'lead_followup_day3',
  siteVisitReminder: 'site_visit_reminder',
  ownerNewLeadAlert: 'owner_new_lead_alert',
  callbackMissed: 'callback_missed',
} as const;

export type WaTemplateDefinition = {
  name: string;
  label: string;
  languageCode: string;
  bodyVariableCount: number;
  purpose: 'follow_up' | 'welcome' | 'campaign' | 'general' | 'owner_alert';
};

const DEFAULT_CATALOG: WaTemplateDefinition[] = [
  {
    name: TEMPLATE_NAMES.leadWelcome,
    label: 'Lead welcome',
    languageCode: 'en',
    bodyVariableCount: 2,
    purpose: 'welcome',
  },
  {
    name: TEMPLATE_NAMES.leadFollowupDay1,
    label: 'Follow-up day 1',
    languageCode: 'en',
    bodyVariableCount: 1,
    purpose: 'follow_up',
  },
  {
    name: TEMPLATE_NAMES.leadFollowupDay3,
    label: 'Follow-up day 3',
    languageCode: 'en',
    bodyVariableCount: 1,
    purpose: 'follow_up',
  },
  {
    name: TEMPLATE_NAMES.siteVisitReminder,
    label: 'Site visit reminder',
    languageCode: 'en',
    bodyVariableCount: 2,
    purpose: 'follow_up',
  },
  {
    name: TEMPLATE_NAMES.ownerNewLeadAlert,
    label: 'Owner new lead alert',
    languageCode: 'en',
    bodyVariableCount: 4,
    purpose: 'owner_alert',
  },
  {
    name: TEMPLATE_NAMES.callbackMissed,
    label: 'Missed callback',
    languageCode: 'en',
    bodyVariableCount: 1,
    purpose: 'general',
  },
];

export function getWaTemplateCatalog(): WaTemplateDefinition[] {
  const lang = getWhatsAppDefaultLanguage();
  return DEFAULT_CATALOG.map((row) => ({ ...row, languageCode: row.languageCode || lang }));
}

export function getTemplateByName(name: string): WaTemplateDefinition | undefined {
  return getWaTemplateCatalog().find((row) => row.name === name);
}

export function getDefaultFollowUpTemplate(): WaTemplateDefinition {
  return (
    getWaTemplateCatalog().find((row) => row.name === TEMPLATE_NAMES.leadFollowupDay1)
    || getWaTemplateCatalog().find((row) => row.purpose === 'follow_up')
    || getWaTemplateCatalog()[0]
  );
}

export async function upsertSyncedTemplates(db: Db, templates: CloudTemplate[]): Promise<number> {
  const now = new Date().toISOString();
  let count = 0;
  for (const template of templates) {
    if (!template.name) continue;
    await db.collection(WA_TEMPLATES_COLLECTION).updateOne(
      { name: template.name, language: template.language },
      {
        $set: {
          name: template.name,
          language: template.language,
          status: template.status,
          category: template.category || null,
          components: template.components || [],
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    count += 1;
  }
  return count;
}

export async function listStoredTemplates(db: Db) {
  return db.collection(WA_TEMPLATES_COLLECTION)
    .find({}, { projection: { _id: 0 } })
    .sort({ name: 1 })
    .limit(200)
    .toArray();
}

export async function applyTemplateStatusUpdate(
  db: Db,
  update: {
    name: string;
    language?: string;
    status?: string;
    category?: string;
    reason?: string;
  },
) {
  const now = new Date().toISOString();
  await db.collection(WA_TEMPLATES_COLLECTION).updateOne(
    { name: update.name, language: update.language || getWhatsAppDefaultLanguage() },
    {
      $set: {
        name: update.name,
        language: update.language || getWhatsAppDefaultLanguage(),
        status: update.status || 'UNKNOWN',
        category: update.category || null,
        reason: update.reason || null,
        updatedAt: now,
      },
      $setOnInsert: { createdAt: now, components: [] },
    },
    { upsert: true },
  );
}
