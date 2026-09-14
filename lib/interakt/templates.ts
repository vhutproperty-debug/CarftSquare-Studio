/**
 * Approved Interakt template catalog for Ops.
 * Names must match Interakt template code names.
 * Override via INTERAKT_TEMPLATE_CATALOG JSON env if needed.
 */

export type InteraktTemplateDefinition = {
  name: string;
  label: string;
  languageCode: string;
  bodyVariableCount: number;
  purpose: 'follow_up' | 'welcome' | 'campaign' | 'general';
};

const DEFAULT_CATALOG: InteraktTemplateDefinition[] = [
  {
    name: 'craftsquare_follow_up',
    label: 'General follow-up',
    languageCode: 'en',
    bodyVariableCount: 1,
    purpose: 'follow_up',
  },
  {
    name: 'craftsquare_welcome',
    label: 'Welcome / acknowledgement',
    languageCode: 'en',
    bodyVariableCount: 1,
    purpose: 'welcome',
  },
];

export function getInteraktTemplateCatalog(): InteraktTemplateDefinition[] {
  const raw = process.env.INTERAKT_TEMPLATE_CATALOG?.trim();
  if (!raw) return DEFAULT_CATALOG;
  try {
    const parsed = JSON.parse(raw) as InteraktTemplateDefinition[];
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_CATALOG;
    return parsed.filter((t) => t?.name && t?.label);
  } catch {
    return DEFAULT_CATALOG;
  }
}

export function getTemplateByName(name: string): InteraktTemplateDefinition | undefined {
  return getInteraktTemplateCatalog().find((t) => t.name === name);
}

export function getDefaultFollowUpTemplate(): InteraktTemplateDefinition {
  return (
    getInteraktTemplateCatalog().find((t) => t.purpose === 'follow_up')
    || getInteraktTemplateCatalog()[0]
  );
}
