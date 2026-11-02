import { randomUUID } from 'node:crypto';
import { ProjectValidationError } from '@/lib/ops/projects/errors';
import {
  isChannelPartnerStatus,
  isDeveloperStatus,
  isListingType,
  isResaleUnitStatus,
  normalizeDeveloperStatus,
  parseBhks,
  parseCarpet,
  parseCrores,
  parsePsf,
  safeAssetUrl,
  slugify,
} from '@/lib/ops/projects/format';
import type {
  ChannelPartnerStatus,
  DeveloperProjectStatus,
  FloorPlan,
  ProjectContact,
  ResaleListingType,
  ResaleOwner,
  ResaleUnitStatus,
} from '@/lib/ops/projects/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}

function readString(body: Record<string, unknown>, key: string, max: number): string | undefined {
  if (!has(body, key)) return undefined;
  if (body[key] == null) return '';
  if (typeof body[key] !== 'string') throw new ProjectValidationError(`${key} must be a string.`);
  return body[key].trim().slice(0, max);
}

function readNumber(body: Record<string, unknown>, key: string): number | null | undefined {
  if (!has(body, key)) return undefined;
  if (body[key] == null || body[key] === '') return null;
  const value = typeof body[key] === 'number' ? body[key] : Number(String(body[key]).replace(/,/g, ''));
  if (!Number.isFinite(value) || value < 0) throw new ProjectValidationError(`${key} must be a number that is zero or greater.`);
  return value;
}

function readStringList(body: Record<string, unknown>, key: string, maxItems: number, maxLen: number): string[] | undefined {
  if (!has(body, key)) return undefined;
  const value = body[key];
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\n/)
      : null;
  if (!source) throw new ProjectValidationError(`${key} must be a list of strings.`);
  if (source.length > maxItems) throw new ProjectValidationError(`${key} has too many entries.`);
  return source.map((item, index) => {
    if (typeof item !== 'string') throw new ProjectValidationError(`${key}[${index}] must be a string.`);
    return item.trim().slice(0, maxLen);
  }).filter(Boolean);
}

function readUrlList(body: Record<string, unknown>, key: string): string[] | undefined {
  const list = readStringList(body, key, 30, 600);
  if (!list) return undefined;
  return list.map((item) => {
    const url = safeAssetUrl(item);
    if (url == null) throw new ProjectValidationError(`${key} must be http(s) links.`);
    return url;
  }).filter(Boolean);
}

function readUrl(body: Record<string, unknown>, key: string): string | undefined {
  const value = readString(body, key, 600);
  if (value === undefined) return undefined;
  const url = safeAssetUrl(value);
  if (url == null) throw new ProjectValidationError(`${key} must be an http(s) link or an uploaded file URL.`);
  return url;
}

function readContacts(body: Record<string, unknown>, key: string): ProjectContact[] | undefined {
  if (!has(body, key)) return undefined;
  if (!Array.isArray(body[key])) throw new ProjectValidationError(`${key} must be a list.`);
  if (body[key].length > 30) throw new ProjectValidationError(`${key} has too many people.`);
  return body[key].map((item, index) => {
    if (!isRecord(item)) throw new ProjectValidationError(`${key}[${index}] must be an object.`);
    return {
      name: readString(item, 'name', 120) || '',
      role: readString(item, 'role', 120) || '',
      phone: readString(item, 'phone', 40) || '',
      email: readString(item, 'email', 160) || '',
    };
  }).filter((contact) => contact.name || contact.role || contact.phone || contact.email);
}

function readFloorPlans(body: Record<string, unknown>): FloorPlan[] | undefined {
  if (!has(body, 'floorPlans')) return undefined;
  if (!Array.isArray(body.floorPlans)) throw new ProjectValidationError('floorPlans must be a list.');
  if (body.floorPlans.length > 40) throw new ProjectValidationError('floorPlans has too many files.');
  return body.floorPlans.map((item, index) => {
    if (!isRecord(item)) throw new ProjectValidationError(`floorPlans[${index}] must be an object.`);
    const url = readUrl(item, 'url');
    if (!url) throw new ProjectValidationError(`floorPlans[${index}].url is required.`);
    const name = readString(item, 'name', 160) || `Floor plan ${index + 1}`;
    const kindValue = readString(item, 'kind', 20);
    const kind = kindValue === 'pdf' || url.toLowerCase().includes('.pdf') ? 'pdf' : 'image';
    const id = readString(item, 'id', 80) || randomUUID();
    return { id, name, url, kind };
  });
}

function readBhks(body: Record<string, unknown>): number[] | undefined {
  if (!has(body, 'bhk')) return undefined;
  if (!Array.isArray(body.bhk)) throw new ProjectValidationError('bhk must be a list of numbers.');
  return body.bhk.map((item) => {
    const value = typeof item === 'number' ? item : Number(item);
    if (!Number.isFinite(value) || value <= 0 || value > 20) throw new ProjectValidationError('bhk values must be between 1 and 20.');
    return value;
  });
}

export type DeveloperWrite = {
  slug: string;
  patch: Record<string, unknown>;
  name?: string;
};

export function parseDeveloperWrite(body: unknown): DeveloperWrite {
  if (!isRecord(body)) throw new ProjectValidationError('Project payload must be an object.');
  const name = readString(body, 'name', 160);
  const explicitSlug = readString(body, 'slug', 80);
  const slug = slugify(explicitSlug || name || '');
  if (!slug) throw new ProjectValidationError('A name or slug is required.');
  const patch: Record<string, unknown> = { slug };
  if (name !== undefined) patch.name = name;
  const developer = readString(body, 'developer', 200);
  if (developer !== undefined) patch.developer = developer;
  const locality = readString(body, 'locality', 120);
  if (locality !== undefined) patch.locality = locality;
  const address = readString(body, 'address', 240);
  if (address !== undefined) patch.address = address;
  const maharera = readString(body, 'maharera', 40);
  if (maharera !== undefined) patch.maharera = maharera;
  const statusLabel = readString(body, 'statusLabel', 160);
  if (statusLabel !== undefined) patch.statusLabel = statusLabel;
  if (has(body, 'status')) {
    const status = readString(body, 'status', 40) || '';
    if (isDeveloperStatus(status)) patch.status = status;
    else if (status) patch.status = normalizeDeveloperStatus(status);
    else patch.status = 'other';
  } else if (statusLabel) {
    patch.status = normalizeDeveloperStatus(statusLabel);
  }
  const configLabel = readString(body, 'configLabel', 300);
  if (configLabel !== undefined) patch.configLabel = configLabel;
  const bhk = readBhks(body);
  if (bhk) patch.bhk = bhk;
  else if (configLabel) patch.bhk = parseBhks(configLabel);
  const priceLabel = readString(body, 'priceLabel', 240);
  if (priceLabel !== undefined) patch.priceLabel = priceLabel;
  assignNumber(patch, 'priceMinCrore', readNumber(body, 'priceMinCrore'));
  assignNumber(patch, 'priceMaxCrore', readNumber(body, 'priceMaxCrore'));
  assignNumber(patch, 'pricePerSqft', readNumber(body, 'pricePerSqft'));
  assignNumber(patch, 'pricePerSqftMax', readNumber(body, 'pricePerSqftMax'));
  assignNumber(patch, 'carpetMinSqft', readNumber(body, 'carpetMinSqft'));
  assignNumber(patch, 'carpetMaxSqft', readNumber(body, 'carpetMaxSqft'));
  if (priceLabel && !has(body, 'priceMinCrore')) {
    const price = parseCrores(priceLabel);
    patch.priceMinCrore = price.min;
    if (!has(body, 'priceMaxCrore')) patch.priceMaxCrore = price.max;
  }
  if (priceLabel && !has(body, 'pricePerSqft')) {
    const psf = parsePsf(priceLabel);
    patch.pricePerSqft = psf.min;
    if (!has(body, 'pricePerSqftMax')) patch.pricePerSqftMax = psf.max;
  }
  if (configLabel && !has(body, 'carpetMinSqft')) {
    const carpet = parseCarpet(configLabel);
    patch.carpetMinSqft = carpet.min;
    if (!has(body, 'carpetMaxSqft')) patch.carpetMaxSqft = carpet.max;
  }
  const possession = readString(body, 'possession', 120);
  if (possession !== undefined) patch.possession = possession;
  const inventoryNote = readString(body, 'inventoryNote', 400);
  if (inventoryNote !== undefined) patch.inventoryNote = inventoryNote;
  const offerNote = readString(body, 'offerNote', 400);
  if (offerNote !== undefined) patch.offerNote = offerNote;
  if (has(body, 'channelPartnerStatus')) {
    const status = readString(body, 'channelPartnerStatus', 40) || '';
    if (!isChannelPartnerStatus(status)) throw new ProjectValidationError('channelPartnerStatus must be not_approached, applied, or empanelled.');
    patch.channelPartnerStatus = status satisfies ChannelPartnerStatus;
  }
  const usps = readStringList(body, 'usps', 30, 240);
  if (usps) patch.usps = usps;
  const amenities = readStringList(body, 'amenities', 40, 120);
  if (amenities) patch.amenities = amenities;
  const floorPlans = readFloorPlans(body);
  if (floorPlans) patch.floorPlans = floorPlans;
  const brochureUrl = readUrl(body, 'brochureUrl');
  if (brochureUrl !== undefined) patch.brochureUrl = brochureUrl;
  const contacts = readContacts(body, 'contacts');
  if (contacts) patch.contacts = contacts;
  const notes = readString(body, 'notes', 4000);
  if (notes !== undefined) patch.notes = notes;
  const sourceLinks = readUrlList(body, 'sourceLinks');
  if (sourceLinks) patch.sourceLinks = sourceLinks;
  return { slug, patch, name };
}

export type ResaleProjectWrite = { slug: string; patch: Record<string, unknown>; name?: string };

export function parseResaleProjectWrite(body: Record<string, unknown>): ResaleProjectWrite {
  const name = readString(body, 'name', 160);
  const explicitSlug = readString(body, 'slug', 80);
  const slug = slugify(explicitSlug || name || '');
  if (!slug) throw new ProjectValidationError('A name or slug is required.');
  const patch: Record<string, unknown> = { slug, focus: 'resale' };
  if (name !== undefined) patch.name = name;
  const developer = readString(body, 'developer', 200);
  if (developer !== undefined) patch.developer = developer;
  const locality = readString(body, 'locality', 120);
  if (locality !== undefined) patch.locality = locality;
  const towers = readStringList(body, 'towers', 40, 80);
  if (towers) patch.towers = towers;
  const maharera = readString(body, 'maharera', 40);
  if (maharera !== undefined) patch.maharera = maharera;
  const notes = readString(body, 'notes', 4000);
  if (notes !== undefined) patch.notes = notes;
  const sourceLinks = readUrlList(body, 'sourceLinks');
  if (sourceLinks) patch.sourceLinks = sourceLinks;
  const usps = readStringList(body, 'usps', 30, 240);
  if (usps) patch.usps = usps;
  const amenities = readStringList(body, 'amenities', 40, 120);
  if (amenities) patch.amenities = amenities;
  return { slug, patch, name };
}

export type ResaleUnitWrite = { slug: string; patch: Record<string, unknown>; projectSlug?: string };

export function parseResaleUnitWrite(body: Record<string, unknown>): ResaleUnitWrite {
  const projectSlugRaw = readString(body, 'projectSlug', 80);
  const projectSlug = projectSlugRaw ? slugify(projectSlugRaw) : undefined;
  const tower = readString(body, 'tower', 80);
  const unitNumber = readString(body, 'unitNumber', 40);
  const explicitSlug = readString(body, 'slug', 80);
  const generated = [projectSlug, tower ? slugify(tower) : '', 'unit', randomUUID().slice(0, 8)].filter(Boolean).join('-');
  const slug = slugify(explicitSlug || generated);
  if (!slug) throw new ProjectValidationError('A slug or project is required for a resale unit.');
  if (unitNumber && slugHasFlatNumber(slug, unitNumber)) {
    throw new ProjectValidationError('Keep the flat number out of the slug. Slugs are visible to every ops user.');
  }
  if (unitNumber && unitNumber.length >= 3 && tower && tower.toLowerCase().includes(unitNumber.toLowerCase())) {
    throw new ProjectValidationError('Put the flat number in unitNumber, not the tower name.');
  }
  const patch: Record<string, unknown> = { slug };
  if (projectSlug) patch.projectSlug = projectSlug;
  if (tower !== undefined) patch.tower = tower;
  if (unitNumber !== undefined) patch.unitNumber = unitNumber;
  if (has(body, 'bhk')) {
    const bhk = readNumber(body, 'bhk');
    if (bhk != null && (bhk <= 0 || bhk > 20)) throw new ProjectValidationError('bhk must be between 1 and 20.');
    patch.bhk = bhk ?? null;
  }
  assignNumber(patch, 'carpetSqft', readNumber(body, 'carpetSqft'));
  const floorBand = readString(body, 'floorBand', 40);
  if (floorBand !== undefined) patch.floorBand = floorBand;
  const askingPriceLabel = readString(body, 'askingPriceLabel', 160);
  if (askingPriceLabel !== undefined) patch.askingPriceLabel = askingPriceLabel;
  assignNumber(patch, 'askingPriceCrore', readNumber(body, 'askingPriceCrore'));
  if (askingPriceLabel && !has(body, 'askingPriceCrore')) {
    patch.askingPriceCrore = parseCrores(askingPriceLabel).min;
  }
  if (has(body, 'status')) {
    const status = readString(body, 'status', 40) || '';
    if (!isResaleUnitStatus(status)) throw new ProjectValidationError('status must be available, under_offer, or sold.');
    patch.status = status satisfies ResaleUnitStatus;
  }
  if (has(body, 'listingType')) {
    const listingType = readString(body, 'listingType', 20) || '';
    if (!isListingType(listingType)) throw new ProjectValidationError('listingType must be resale or rental.');
    patch.listingType = listingType satisfies ResaleListingType;
  }
  if (has(body, 'owner')) {
    if (!isRecord(body.owner) && body.owner != null) throw new ProjectValidationError('owner must be an object.');
    const owner = isRecord(body.owner) ? body.owner : {};
    const value: ResaleOwner = {
      name: readString(owner, 'name', 120) || '',
      phone: readString(owner, 'phone', 40) || '',
      email: readString(owner, 'email', 160) || '',
    };
    patch.owner = value;
  }
  const notes = readString(body, 'notes', 4000);
  if (notes !== undefined) patch.notes = notes;
  const sourceLinks = readUrlList(body, 'sourceLinks');
  if (sourceLinks) patch.sourceLinks = sourceLinks;
  return { slug, patch, projectSlug };
}

function slugHasFlatNumber(slug: string, unitNumber: string): boolean {
  const token = slugify(unitNumber);
  if (!token || token.length < 3) return false;
  return slug === token || slug.startsWith(`${token}-`) || slug.endsWith(`-${token}`) || slug.includes(`-${token}-`);
}

function assignNumber(patch: Record<string, unknown>, key: string, value: number | null | undefined) {
  if (value !== undefined) patch[key] = value;
}

export function assertRecordType(body: Record<string, unknown>): 'project' | 'unit' {
  const recordType = typeof body.recordType === 'string' ? body.recordType : '';
  if (recordType !== 'project' && recordType !== 'unit') {
    throw new ProjectValidationError('recordType must be project or unit.');
  }
  return recordType;
}

export function emptyDeveloperFields() {
  return {
    developer: '',
    locality: '',
    address: '',
    maharera: '',
    status: 'other' as DeveloperProjectStatus,
    statusLabel: '',
    configLabel: '',
    bhk: [] as number[],
    carpetMinSqft: null,
    carpetMaxSqft: null,
    priceLabel: '',
    priceMinCrore: null,
    priceMaxCrore: null,
    pricePerSqft: null,
    pricePerSqftMax: null,
    possession: '',
    inventoryNote: '',
    offerNote: '',
    channelPartnerStatus: 'not_approached' as ChannelPartnerStatus,
    usps: [] as string[],
    amenities: [] as string[],
    floorPlans: [] as FloorPlan[],
    brochureUrl: '',
    contacts: [] as ProjectContact[],
    notes: '',
    sourceLinks: [] as string[],
  };
}
