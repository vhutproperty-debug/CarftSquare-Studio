import type { Db } from 'mongodb';
import type { OpsLeadSource } from '@/lib/ops/leads/types';
import { normalizeIndianMobile } from '@/lib/phone/indian-mobile';
import { phoneStorageVariants } from '@/lib/interakt/phone';
import type {
  IdentityMatchResult,
  InteraktLinkCandidate,
  InteraktMatchField,
} from '@/lib/interakt/types';

type LeadPhoneSource = {
  source: OpsLeadSource;
  collection: string;
  phonePaths: string[];
  matchField: InteraktMatchField;
  namePath?: string;
};

const LEAD_PHONE_SOURCES: LeadPhoneSource[] = [
  { source: 'homepage', collection: 'leads', phonePaths: ['phone'], matchField: 'lead.phone', namePath: 'name' },
  { source: 'painting', collection: 'painting_leads', phonePaths: ['mobile'], matchField: 'lead.mobile', namePath: 'name' },
  { source: 'auris_serenity', collection: 'auris_serenity_leads', phonePaths: ['mobile'], matchField: 'lead.mobile', namePath: 'name' },
  { source: 'satellite_elegance', collection: 'satellite_elegance_leads', phonePaths: ['mobile'], matchField: 'lead.mobile', namePath: 'name' },
  { source: 'designer_callback', collection: 'designer_callback_leads', phonePaths: ['phone'], matchField: 'lead.phone', namePath: 'name' },
  {
    source: 'quotation',
    collection: 'quotation_quotes',
    phonePaths: ['customer.phone', 'customer.whatsapp'],
    matchField: 'lead.phone',
    namePath: 'customer.name',
  },
  { source: 'housing_com', collection: 'housing_com_leads', phonePaths: ['phone'], matchField: 'lead.phone', namePath: 'name' },
  {
    source: 'housing',
    collection: 'ops_housing_raw',
    phonePaths: ['normalized.mobile'],
    matchField: 'lead.mobile',
    namePath: 'normalized.customerName',
  },
  {
    source: 'meta_ads',
    collection: 'meta_ads_leads',
    phonePaths: ['phone'],
    matchField: 'lead.phone',
    namePath: 'name',
  },
];

function personKeyForCandidate(c: Omit<InteraktLinkCandidate, 'personKey'> & { prospectIdHint?: string }): string {
  if (c.entityType === 'ops_prospect') return `prospect:${c.entityId}`;
  if (c.entityType === 'ops_supply_record') {
    if (c.prospectIdHint) return `prospect:${c.prospectIdHint}`;
    return `supply:${c.entityId}`;
  }
  if (c.entityType === 'ops_lead') return `lead:${c.source}:${c.entityId}`;
  if (c.entityType === 'ops_demand_record') return `demand:${c.source}:${c.entityId}`;
  return `${c.entityType}:${c.entityId}`;
}

function getNested(doc: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, doc);
}

function phonesEqual(stored: unknown, normalizedPhone: string): boolean {
  const value = normalizeIndianMobile(stored);
  return Boolean(value) && value === normalizedPhone;
}

/**
 * Non-destructive exact phone match against existing CraftSquare CRM records.
 * Never creates, merges, deletes, or mutates CRM rows.
 */
export async function resolveIdentityByPhone(
  db: Db,
  normalizedPhone: string,
): Promise<IdentityMatchResult> {
  const candidates: InteraktLinkCandidate[] = [];
  const variants = phoneStorageVariants(normalizedPhone);
  if (!normalizedPhone || !variants.length) {
    return { matchStatus: 'unmatched', primaryLink: null, candidateLinks: [] };
  }

  const prospects = await db
    .collection('ops_prospects')
    .find(
      {
        $or: [
          { phone: { $in: variants } },
          { alternatePhone: { $in: variants } },
        ],
      },
      { projection: { _id: 0, id: 1, name: 1, phone: 1, alternatePhone: 1, projectName: 1 } },
    )
    .limit(50)
    .toArray();

  for (const doc of prospects) {
    const record = doc as unknown as {
      id: string;
      name?: string;
      phone?: string;
      alternatePhone?: string;
      projectName?: string;
    };
    const viaPhone = phonesEqual(record.phone, normalizedPhone);
    const viaAlt = phonesEqual(record.alternatePhone, normalizedPhone);
    if (!viaPhone && !viaAlt) continue;

    const base = {
      entityType: 'ops_prospect' as const,
      entityId: record.id,
      matchField: (viaPhone ? 'phone' : 'alternatePhone') as InteraktMatchField,
      confidence: 'exact' as const,
      label: record.name || record.projectName || record.id,
    };
    candidates.push({ ...base, personKey: personKeyForCandidate(base) });
  }

  const supplies = await db
    .collection('ops_supply_records')
    .find(
      {
        $or: [
          { normalizedOwnerMobile: { $in: variants } },
          { ownerMobile: { $in: variants } },
        ],
      },
      {
        projection: {
          _id: 0,
          id: 1,
          ownerName: 1,
          ownerMobile: 1,
          normalizedOwnerMobile: 1,
          prospectId: 1,
          project: 1,
          building: 1,
          flatNumber: 1,
        },
      },
    )
    .limit(50)
    .toArray();

  for (const doc of supplies) {
    const record = doc as unknown as {
      id: string;
      ownerName?: string;
      ownerMobile?: string;
      normalizedOwnerMobile?: string;
      prospectId?: string;
      project?: string;
      building?: string;
      flatNumber?: string;
    };
    const viaNorm = phonesEqual(record.normalizedOwnerMobile, normalizedPhone);
    const viaRaw = phonesEqual(record.ownerMobile, normalizedPhone);
    if (!viaNorm && !viaRaw) continue;

    const base = {
      entityType: 'ops_supply_record' as const,
      entityId: record.id,
      matchField: 'normalizedOwnerMobile' as InteraktMatchField,
      confidence: 'exact' as const,
      label: record.ownerName || [record.building, record.flatNumber, record.project].filter(Boolean).join(' · ') || record.id,
      prospectIdHint: record.prospectId,
    };
    candidates.push({
      entityType: base.entityType,
      entityId: base.entityId,
      matchField: base.matchField,
      confidence: base.confidence,
      label: base.label,
      personKey: personKeyForCandidate(base),
    });

    if (record.prospectId && !candidates.some((c) => c.entityType === 'ops_prospect' && c.entityId === record.prospectId)) {
      const linked = {
        entityType: 'ops_prospect' as const,
        entityId: record.prospectId,
        matchField: 'normalizedOwnerMobile' as InteraktMatchField,
        confidence: 'exact' as const,
        label: `linked-via-supply:${record.id}`,
      };
      candidates.push({ ...linked, personKey: personKeyForCandidate(linked) });
    }
  }

  for (const source of LEAD_PHONE_SOURCES) {
    const orFilters = source.phonePaths.map((path) => ({ [path]: { $in: variants } }));
    let docs: Record<string, unknown>[] = [];
    try {
      docs = (await db
        .collection(source.collection)
        .find(
          { $or: orFilters },
          { projection: { _id: 0, id: 1 } },
        )
        .limit(50)
        .toArray()) as Record<string, unknown>[];
    } catch {
      continue;
    }

    // Re-fetch with needed fields for label + verify normalize equality
    if (!docs.length) continue;
    const ids = docs.map((d) => d.id).filter(Boolean);
    const full = (await db
      .collection(source.collection)
      .find({ id: { $in: ids } }, { projection: { _id: 0 } })
      .limit(50)
      .toArray()) as Record<string, unknown>[];

    for (const doc of full) {
      const matchedPath = source.phonePaths.find((path) => phonesEqual(getNested(doc, path), normalizedPhone));
      if (!matchedPath || !doc.id) continue;
      const name = source.namePath ? getNested(doc, source.namePath) : undefined;
      const base = {
        entityType: 'ops_lead' as const,
        entityId: String(doc.id),
        source: source.source,
        sourceCollection: source.collection,
        matchField: source.matchField,
        confidence: 'exact' as const,
        label: typeof name === 'string' ? name : String(doc.id),
      };
      candidates.push({ ...base, personKey: personKeyForCandidate(base) });
    }
  }

  const deduped = dedupeCandidates(candidates);
  return finalizeMatch(deduped);
}

function dedupeCandidates(candidates: InteraktLinkCandidate[]): InteraktLinkCandidate[] {
  const seen = new Set<string>();
  const out: InteraktLinkCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.entityType}:${c.source || ''}:${c.entityId}:${c.matchField}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function finalizeMatch(candidates: InteraktLinkCandidate[]): IdentityMatchResult {
  if (!candidates.length) {
    return { matchStatus: 'unmatched', primaryLink: null, candidateLinks: [] };
  }

  const personKeys = Array.from(new Set(candidates.map((c) => c.personKey)));

  if (personKeys.length === 1) {
    const primary =
      candidates.find((c) => c.entityType === 'ops_prospect')
      || candidates.find((c) => c.entityType === 'ops_supply_record')
      || candidates[0];
    return { matchStatus: 'matched', primaryLink: primary, candidateLinks: candidates };
  }

  if (candidates.length === 1) {
    return { matchStatus: 'matched', primaryLink: candidates[0], candidateLinks: candidates };
  }

  return { matchStatus: 'ambiguous', primaryLink: null, candidateLinks: candidates };
}
