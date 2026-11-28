/**
 * Template name -> project shown on the ops WhatsApp inbox.
 *
 * Add one line per approved template. Several templates can share a project:
 *   cs_72west_owner_outreach: '72 West',
 *   cs_34park_owner_rent_v1: '34 Park',
 *
 * Extend or override without a code change by setting WA_TEMPLATE_PROJECTS
 * to a JSON object, for example:
 * {"cs_72west_owner_outreach":"72 West","cs_34park_owner_rent_v1":"34 Park"}
 */
export const TEMPLATE_PROJECTS: Record<string, string> = {
  cs_transcon_nri_rent_v1: 'Transcon Triumph',
  cs_transcon_owner_rent_v1: 'Transcon Triumph',
};

const TEMPLATE_BODY = /^(?:follow-up template|campaign template|template)\s*:\s*(.+)$/i;

export type OutboundTemplateSource = {
  direction?: string | null;
  messageType?: string | null;
  bodyText?: string | null;
  templateName?: string | null;
  createdAt?: string | null;
  rawMessage?: {
    is_template_message?: boolean;
    raw_template?: string | null;
    message?: string | null;
  } | null;
};

function projectsFromEnv(): Record<string, string> {
  const raw = process.env.WA_TEMPLATE_PROJECTS?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value !== 'string') continue;
      const name = key.trim();
      const project = value.trim();
      if (!name || !project) continue;
      out[name] = project;
    }
    return out;
  } catch {
    return {};
  }
}

/** Built-in map, with WA_TEMPLATE_PROJECTS layered on top (env wins per key). */
export function templateProjectMap(): Record<string, string> {
  return { ...TEMPLATE_PROJECTS, ...projectsFromEnv() };
}

export function configuredProjectNames(): string[] {
  return [...new Set(Object.values(templateProjectMap()))].sort((a, b) => a.localeCompare(b));
}

export function projectForTemplate(templateName: string | null | undefined): string | null {
  const name = templateName?.trim();
  if (!name) return null;
  const map = templateProjectMap();
  if (map[name]) return map[name];
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === lower) return value;
  }
  return null;
}

/**
 * Template code stored on an outbound wa_messages row.
 * Send paths persist "Template:<name>", "Campaign template:<name>",
 * or "Follow-up template:<name>".
 */
export function templateNameFromOutbound(message: OutboundTemplateSource): string | null {
  if (message.direction && message.direction !== 'outbound') return null;
  const explicit = message.templateName?.trim();
  if (explicit) return explicit;
  const body = (message.bodyText || message.rawMessage?.message || '').trim();
  const match = TEMPLATE_BODY.exec(body);
  if (match?.[1]?.trim()) return match[1].trim();
  const raw = message.rawMessage?.raw_template;
  if (typeof raw === 'string') {
    const name = raw.trim();
    if (name && !name.startsWith('{') && !name.startsWith('[')) return name;
  }
  return null;
}

/** When the outbound template was stored. createdAt is stable across status webhooks. */
export function templateStoredAt(message: OutboundTemplateSource & { createdAt?: string | null }): string {
  return message.createdAt?.trim() || '';
}
