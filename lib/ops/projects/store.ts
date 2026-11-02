import { randomUUID } from 'node:crypto';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import { slugify } from '@/lib/ops/projects/format';
import type { LaunchDraft } from '@/lib/ops/projects/parse-launch-sheet';
import { RESALE_PROJECT_PLACEHOLDERS } from '@/lib/ops/projects/placeholders';
import {
  DEVELOPER_PROJECTS_COLLECTION,
  RESALE_PROJECTS_COLLECTION,
  RESALE_UNITS_COLLECTION,
  type ChannelPartnerStatus,
  type DeveloperProject,
  type DeveloperProjectStatus,
  type FloorPlan,
  type ProjectContact,
  type ResaleListingType,
  type ResaleOwner,
  type ResaleProject,
  type ResaleUnit,
  type ResaleUnitStatus,
} from '@/lib/ops/projects/types';
import { emptyDeveloperFields } from '@/lib/ops/projects/validate';

const ensured = new WeakSet<object>();

export async function getProjectsDatabase(): Promise<Db> {
  return getDb() as Promise<Db>;
}

export async function ensureProjectIndexes(db: Db): Promise<void> {
  if (ensured.has(db)) return;
  await db.collection(DEVELOPER_PROJECTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(DEVELOPER_PROJECTS_COLLECTION).createIndex({ slug: 1 }, { unique: true });
  await db.collection(DEVELOPER_PROJECTS_COLLECTION).createIndex({ locality: 1, developer: 1, status: 1 });
  await db.collection(RESALE_PROJECTS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(RESALE_PROJECTS_COLLECTION).createIndex({ slug: 1 }, { unique: true });
  await db.collection(RESALE_UNITS_COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(RESALE_UNITS_COLLECTION).createIndex({ slug: 1 }, { unique: true });
  await db.collection(RESALE_UNITS_COLLECTION).createIndex({ projectSlug: 1, status: 1 });
  ensured.add(db);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function contactsOf(value: unknown): ProjectContact[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const contact = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      name: text(contact.name),
      role: text(contact.role),
      phone: text(contact.phone),
      email: text(contact.email),
    };
  });
}

function floorPlansOf(value: unknown): FloorPlan[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const plan = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const kind: FloorPlan['kind'] = plan.kind === 'pdf' ? 'pdf' : 'image';
    return {
      id: text(plan.id) || randomUUID(),
      name: text(plan.name) || 'Floor plan',
      url: text(plan.url),
      kind,
    };
  }).filter((plan) => plan.url);
}

function ownerOf(value: unknown): ResaleOwner {
  const owner = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { name: text(owner.name), phone: text(owner.phone), email: text(owner.email) };
}

function developerStatus(value: unknown): DeveloperProjectStatus {
  const status = text(value);
  if (status === 'new_launch' || status === 'under_construction' || status === 'ready' || status === 'sold_out' || status === 'other') {
    return status;
  }
  return 'other';
}

function partnerStatus(value: unknown): ChannelPartnerStatus {
  const status = text(value);
  if (status === 'applied' || status === 'empanelled' || status === 'not_approached') return status;
  return 'not_approached';
}

export function asDeveloperProject(doc: Record<string, unknown>): DeveloperProject {
  return {
    id: text(doc.id),
    slug: text(doc.slug),
    name: text(doc.name),
    developer: text(doc.developer),
    locality: text(doc.locality),
    address: text(doc.address),
    maharera: text(doc.maharera),
    status: developerStatus(doc.status),
    statusLabel: text(doc.statusLabel),
    configLabel: text(doc.configLabel),
    bhk: numberList(doc.bhk),
    carpetMinSqft: numberOrNull(doc.carpetMinSqft),
    carpetMaxSqft: numberOrNull(doc.carpetMaxSqft),
    priceLabel: text(doc.priceLabel),
    priceMinCrore: numberOrNull(doc.priceMinCrore),
    priceMaxCrore: numberOrNull(doc.priceMaxCrore),
    pricePerSqft: numberOrNull(doc.pricePerSqft),
    pricePerSqftMax: numberOrNull(doc.pricePerSqftMax),
    possession: text(doc.possession),
    inventoryNote: text(doc.inventoryNote),
    offerNote: text(doc.offerNote),
    channelPartnerStatus: partnerStatus(doc.channelPartnerStatus),
    usps: textList(doc.usps),
    amenities: textList(doc.amenities),
    floorPlans: floorPlansOf(doc.floorPlans),
    brochureUrl: text(doc.brochureUrl),
    contacts: contactsOf(doc.contacts),
    notes: text(doc.notes),
    sourceLinks: textList(doc.sourceLinks),
    lastUpdatedBy: text(doc.lastUpdatedBy),
    lastUpdatedAt: text(doc.lastUpdatedAt),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
  };
}

export function asResaleProject(doc: Record<string, unknown>): ResaleProject {
  return {
    id: text(doc.id),
    slug: text(doc.slug),
    name: text(doc.name),
    developer: text(doc.developer),
    locality: text(doc.locality),
    towers: textList(doc.towers),
    maharera: text(doc.maharera),
    notes: text(doc.notes),
    sourceLinks: textList(doc.sourceLinks),
    usps: textList(doc.usps),
    amenities: textList(doc.amenities),
    focus: 'resale',
    lastUpdatedBy: text(doc.lastUpdatedBy),
    lastUpdatedAt: text(doc.lastUpdatedAt),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
  };
}

function unitStatus(value: unknown): ResaleUnitStatus {
  const status = text(value);
  if (status === 'under_offer' || status === 'sold' || status === 'available') return status;
  return 'available';
}

function listingType(value: unknown): ResaleListingType {
  return text(value) === 'rental' ? 'rental' : 'resale';
}

export function asResaleUnit(doc: Record<string, unknown>): ResaleUnit {
  return {
    id: text(doc.id),
    slug: text(doc.slug),
    projectSlug: text(doc.projectSlug),
    projectName: text(doc.projectName),
    tower: text(doc.tower),
    unitNumber: text(doc.unitNumber),
    bhk: numberOrNull(doc.bhk),
    carpetSqft: numberOrNull(doc.carpetSqft),
    floorBand: text(doc.floorBand),
    askingPriceCrore: numberOrNull(doc.askingPriceCrore),
    askingPriceLabel: text(doc.askingPriceLabel),
    status: unitStatus(doc.status),
    listingType: listingType(doc.listingType),
    owner: ownerOf(doc.owner),
    notes: text(doc.notes),
    sourceLinks: textList(doc.sourceLinks),
    lastUpdatedBy: text(doc.lastUpdatedBy),
    lastUpdatedAt: text(doc.lastUpdatedAt),
    createdAt: text(doc.createdAt),
    updatedAt: text(doc.updatedAt),
  };
}

async function findOne(db: Db, collection: string, idOrSlug: string): Promise<Record<string, unknown> | null> {
  const doc = await db.collection(collection).findOne({ $or: [{ id: idOrSlug }, { slug: idOrSlug }] });
  return doc ? doc as Record<string, unknown> : null;
}

export async function listDeveloperProjects(db: Db): Promise<DeveloperProject[]> {
  await ensureProjectIndexes(db);
  const docs = await db.collection(DEVELOPER_PROJECTS_COLLECTION).find({}).toArray();
  return docs.map((doc) => asDeveloperProject(doc as Record<string, unknown>));
}

export async function getDeveloperProject(db: Db, idOrSlug: string): Promise<DeveloperProject | null> {
  await ensureProjectIndexes(db);
  const doc = await findOne(db, DEVELOPER_PROJECTS_COLLECTION, idOrSlug);
  return doc ? asDeveloperProject(doc) : null;
}

export async function saveDeveloperProject(
  db: Db,
  input: { slug: string; patch: Record<string, unknown>; name?: string },
  actor: string,
): Promise<{ project: DeveloperProject; created: boolean }> {
  await ensureProjectIndexes(db);
  const existing = await db.collection(DEVELOPER_PROJECTS_COLLECTION).findOne({ slug: input.slug });
  const now = new Date().toISOString();
  const stamp = { updatedAt: now, lastUpdatedAt: now, lastUpdatedBy: actor };
  if (!existing) {
    if (!input.name) throw new ProjectValidationError('A name is required to add a project.');
    const record = {
      id: randomUUID(),
      ...emptyDeveloperFields(),
      ...input.patch,
      name: input.name,
      slug: input.slug,
      createdAt: now,
      ...stamp,
    };
    await db.collection(DEVELOPER_PROJECTS_COLLECTION).insertOne(record);
    return { project: asDeveloperProject(record), created: true };
  }
  const patch: Record<string, unknown> = { ...input.patch, ...stamp };
  delete patch.slug;
  await db.collection(DEVELOPER_PROJECTS_COLLECTION).updateOne({ slug: input.slug }, { $set: patch });
  const saved = await getDeveloperProject(db, input.slug);
  if (!saved) throw new ProjectValidationError('The project could not be saved.');
  return { project: saved, created: false };
}

export async function importDeveloperDraft(db: Db, draft: LaunchDraft, actor: string): Promise<'created' | 'updated'> {
  await ensureProjectIndexes(db);
  const existing = await db.collection(DEVELOPER_PROJECTS_COLLECTION).findOne({ slug: draft.slug });
  const now = new Date().toISOString();
  const launchFields = {
    name: draft.name,
    developer: draft.developer,
    locality: draft.locality,
    address: draft.address,
    maharera: draft.maharera,
    status: draft.status,
    statusLabel: draft.statusLabel,
    configLabel: draft.configLabel,
    bhk: draft.bhk,
    carpetMinSqft: draft.carpetMinSqft,
    carpetMaxSqft: draft.carpetMaxSqft,
    priceLabel: draft.priceLabel,
    priceMinCrore: draft.priceMinCrore,
    priceMaxCrore: draft.priceMaxCrore,
    pricePerSqft: draft.pricePerSqft,
    pricePerSqftMax: draft.pricePerSqftMax,
    possession: draft.possession,
    inventoryNote: draft.inventoryNote,
    offerNote: draft.offerNote,
    sourceLinks: draft.sourceLinks,
    updatedAt: now,
    lastUpdatedAt: now,
    lastUpdatedBy: actor,
  };
  if (!existing) {
    await db.collection(DEVELOPER_PROJECTS_COLLECTION).insertOne({
      id: randomUUID(),
      slug: draft.slug,
      ...emptyDeveloperFields(),
      ...launchFields,
      createdAt: now,
    });
    return 'created';
  }
  await db.collection(DEVELOPER_PROJECTS_COLLECTION).updateOne({ slug: draft.slug }, { $set: launchFields });
  return 'updated';
}

export async function deleteDeveloperProject(db: Db, idOrSlug: string): Promise<boolean> {
  await ensureProjectIndexes(db);
  const existing = await getDeveloperProject(db, idOrSlug);
  if (!existing) return false;
  await db.collection(DEVELOPER_PROJECTS_COLLECTION).deleteOne({ slug: existing.slug });
  return true;
}

export async function listResaleProjects(db: Db): Promise<ResaleProject[]> {
  await ensureProjectIndexes(db);
  const docs = await db.collection(RESALE_PROJECTS_COLLECTION).find({}).toArray();
  return docs.map((doc) => asResaleProject(doc as Record<string, unknown>));
}

export async function getResaleProject(db: Db, idOrSlug: string): Promise<ResaleProject | null> {
  await ensureProjectIndexes(db);
  const doc = await findOne(db, RESALE_PROJECTS_COLLECTION, idOrSlug);
  return doc ? asResaleProject(doc) : null;
}

export async function saveResaleProject(
  db: Db,
  input: { slug: string; patch: Record<string, unknown>; name?: string },
  actor: string,
): Promise<{ project: ResaleProject; created: boolean }> {
  await ensureProjectIndexes(db);
  const existing = await db.collection(RESALE_PROJECTS_COLLECTION).findOne({ slug: input.slug });
  const now = new Date().toISOString();
  const stamp = { updatedAt: now, lastUpdatedAt: now, lastUpdatedBy: actor, focus: 'resale' as const };
  if (!existing) {
    if (!input.name) throw new ProjectValidationError('A name is required to add a resale project.');
    const record = {
      id: randomUUID(),
      slug: input.slug,
      name: input.name,
      developer: '',
      locality: '',
      towers: [],
      maharera: '',
      notes: '',
      sourceLinks: [],
      usps: [],
      amenities: [],
      createdAt: now,
      ...input.patch,
      ...stamp,
    };
    await db.collection(RESALE_PROJECTS_COLLECTION).insertOne(record);
    return { project: asResaleProject(record), created: true };
  }
  const patch: Record<string, unknown> = { ...input.patch, ...stamp };
  delete patch.slug;
  await db.collection(RESALE_PROJECTS_COLLECTION).updateOne({ slug: input.slug }, { $set: patch });
  if (typeof input.patch.name === 'string') {
    await db.collection(RESALE_UNITS_COLLECTION).updateMany(
      { projectSlug: input.slug },
      { $set: { projectName: input.patch.name } },
    );
  }
  const saved = await getResaleProject(db, input.slug);
  if (!saved) throw new ProjectValidationError('The resale project could not be saved.');
  return { project: saved, created: false };
}

export async function seedResalePlaceholders(db: Db, actor = 'import'): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;
  for (const item of RESALE_PROJECT_PLACEHOLDERS) {
    const slug = slugify(item.name);
    const found = await getResaleProject(db, slug);
    if (found) {
      existing += 1;
      continue;
    }
    await saveResaleProject(db, {
      slug,
      name: item.name,
      patch: { name: item.name, developer: item.developer, locality: item.locality, towers: [], notes: '', sourceLinks: [], usps: [], amenities: [], maharera: '' },
    }, actor);
    created += 1;
  }
  return { created, existing };
}

export async function deleteResaleProject(db: Db, idOrSlug: string): Promise<boolean> {
  await ensureProjectIndexes(db);
  const existing = await getResaleProject(db, idOrSlug);
  if (!existing) return false;
  const units = await db.collection(RESALE_UNITS_COLLECTION).countDocuments({ projectSlug: existing.slug });
  if (units > 0) throw new ProjectValidationError('Remove this project’s units before deleting it.');
  await db.collection(RESALE_PROJECTS_COLLECTION).deleteOne({ slug: existing.slug });
  return true;
}

export async function listResaleUnits(db: Db): Promise<ResaleUnit[]> {
  await ensureProjectIndexes(db);
  const docs = await db.collection(RESALE_UNITS_COLLECTION).find({}).toArray();
  return docs.map((doc) => asResaleUnit(doc as Record<string, unknown>));
}

export async function getResaleUnit(db: Db, idOrSlug: string): Promise<ResaleUnit | null> {
  await ensureProjectIndexes(db);
  const doc = await findOne(db, RESALE_UNITS_COLLECTION, idOrSlug);
  return doc ? asResaleUnit(doc) : null;
}

export async function saveResaleUnit(
  db: Db,
  input: { slug: string; patch: Record<string, unknown>; projectSlug?: string },
  actor: string,
): Promise<{ unit: ResaleUnit; created: boolean }> {
  await ensureProjectIndexes(db);
  const existing = await db.collection(RESALE_UNITS_COLLECTION).findOne({ slug: input.slug });
  const projectSlug = input.projectSlug || text((existing as Record<string, unknown> | null)?.projectSlug);
  if (!projectSlug) throw new ProjectValidationError('projectSlug is required.');
  const project = await getResaleProject(db, projectSlug);
  if (!project) throw new ProjectValidationError('Resale project was not found. Create the project grouping first.');
  const now = new Date().toISOString();
  const stamp = {
    projectSlug: project.slug,
    projectName: project.name,
    updatedAt: now,
    lastUpdatedAt: now,
    lastUpdatedBy: actor,
  };
  if (!existing) {
    const record = {
      id: randomUUID(),
      slug: input.slug,
      tower: '',
      unitNumber: '',
      bhk: null,
      carpetSqft: null,
      floorBand: '',
      askingPriceCrore: null,
      askingPriceLabel: '',
      status: 'available' as const,
      listingType: 'resale' as const,
      owner: { name: '', phone: '', email: '' },
      notes: '',
      sourceLinks: [],
      createdAt: now,
      ...input.patch,
      ...stamp,
    };
    await db.collection(RESALE_UNITS_COLLECTION).insertOne(record);
    return { unit: asResaleUnit(record), created: true };
  }
  const patch: Record<string, unknown> = { ...input.patch, ...stamp };
  delete patch.slug;
  await db.collection(RESALE_UNITS_COLLECTION).updateOne({ slug: input.slug }, { $set: patch });
  const saved = await getResaleUnit(db, input.slug);
  if (!saved) throw new ProjectValidationError('The unit could not be saved.');
  return { unit: saved, created: false };
}

export async function deleteResaleUnit(db: Db, idOrSlug: string): Promise<boolean> {
  await ensureProjectIndexes(db);
  const existing = await getResaleUnit(db, idOrSlug);
  if (!existing) return false;
  await db.collection(RESALE_UNITS_COLLECTION).deleteOne({ slug: existing.slug });
  return true;
}

export async function countUnitsByProject(units: ResaleUnit[]): Promise<Record<string, number>> {
  return units.reduce<Record<string, number>>((counts, unit) => {
    counts[unit.projectSlug] = (counts[unit.projectSlug] || 0) + 1;
    return counts;
  }, {});
}
