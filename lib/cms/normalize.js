import { v4 as uuidv4 } from 'uuid';

export function slugify(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeSeoBlock(input = {}) {
  return {
    metaTitle: String(input.metaTitle || '').trim(),
    metaDescription: String(input.metaDescription || '').trim(),
    keywords: Array.isArray(input.keywords) ? input.keywords.map((k) => String(k).trim()).filter(Boolean) : [],
    ogImage: String(input.ogImage || '').trim(),
    canonicalUrl: String(input.canonicalUrl || '').trim(),
  };
}

export function normalizeAboutContent(input = {}, defaults = {}) {
  const merged = { ...defaults, ...input };
  return {
    id: merged.id || 'main',
    enabled: merged.enabled !== false,
    displayOrder: Number(merged.displayOrder) || 1,
    companyIntroduction: String(merged.companyIntroduction || '').trim(),
    founderMessage: String(merged.founderMessage || '').trim(),
    mission: String(merged.mission || '').trim(),
    vision: String(merged.vision || '').trim(),
    coreValues: Array.isArray(merged.coreValues) ? merged.coreValues.map((v) => ({
      title: String(v.title || '').trim(),
      text: String(v.text || '').trim(),
    })).filter((v) => v.title) : [],
    whyChooseUs: Array.isArray(merged.whyChooseUs) ? merged.whyChooseUs.map((v) => ({
      title: String(v.title || '').trim(),
      text: String(v.text || '').trim(),
    })).filter((v) => v.title) : [],
    experienceYears: String(merged.experienceYears || '').trim(),
    teamDescription: String(merged.teamDescription || '').trim(),
    achievementCounters: Array.isArray(merged.achievementCounters) ? merged.achievementCounters.map((c) => ({
      label: String(c.label || '').trim(),
      value: String(c.value || '').trim(),
      icon: String(c.icon || 'Star').trim(),
    })).filter((c) => c.label) : [],
    images: Array.isArray(merged.images) ? merged.images.map((img) => ({
      url: String(img.url || '').trim(),
      alt: String(img.alt || '').trim(),
    })).filter((img) => img.url) : [],
    certifications: Array.isArray(merged.certifications) ? merged.certifications.map((c) => ({
      name: String(c.name || '').trim(),
      description: String(c.description || '').trim(),
    })).filter((c) => c.name) : [],
    homepageEyebrow: String(merged.homepageEyebrow || 'About Us').trim(),
    homepageTitle: String(merged.homepageTitle || '').trim(),
    homepageSubtitle: String(merged.homepageSubtitle || '').trim(),
    updatedAt: merged.updatedAt || new Date().toISOString(),
  };
}

export function normalizeService(input = {}) {
  const name = String(input.name || input.title || '').trim();
  const slug = slugify(input.slug || input.id || name);
  if (!name || !slug) return null;

  return {
    id: String(input.id || slug).trim(),
    slug,
    name,
    shortDescription: String(input.shortDescription || input.description || '').trim(),
    description: String(input.description || input.shortDescription || '').trim(),
    heroImage: String(input.heroImage || '').trim(),
    galleryImages: Array.isArray(input.galleryImages) ? input.galleryImages.map(String).filter(Boolean) : [],
    features: Array.isArray(input.features) ? input.features.map(String).filter(Boolean) : [],
    icon: String(input.icon || 'Sparkles').trim(),
    priceLabel: String(input.priceLabel || input.price || 'Custom quote').trim(),
    displayOrder: Number(input.displayOrder) || 0,
    active: input.active !== false,
    categoryId: String(input.categoryId || '').trim(),
    isRentalModule: Boolean(input.isRentalModule),
    seo: normalizeSeoBlock(input.seo || {}),
    subServices: Array.isArray(input.subServices) ? input.subServices.map(normalizeSubService).filter(Boolean) : [],
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function normalizeSubService(input = {}) {
  const name = String(input.name || '').trim();
  if (!name) return null;
  return {
    id: String(input.id || slugify(name)).trim(),
    name,
    description: String(input.description || '').trim(),
    displayOrder: Number(input.displayOrder) || 0,
    active: input.active !== false,
  };
}

export function normalizeGalleryCategory(input = {}) {
  const name = String(input.name || '').trim();
  const slug = slugify(input.slug || input.id || name);
  if (!name) return null;
  return {
    id: String(input.id || slug).trim(),
    name,
    slug,
    displayOrder: Number(input.displayOrder) || 0,
    active: input.active !== false,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function normalizeGalleryItem(input = {}) {
  const title = String(input.title || '').trim();
  if (!title) return null;
  const mediaType = input.mediaType === 'video' ? 'video' : 'image';
  const slug = slugify(input.slug || input.id || title);

  return {
    id: String(input.id || uuidv4()).trim(),
    title,
    slug,
    description: String(input.description || '').trim(),
    categoryId: String(input.categoryId || '').trim(),
    category: String(input.category || '').trim(),
    mediaType,
    imageUrl: String(input.imageUrl || '').trim(),
    videoUrl: String(input.videoUrl || '').trim(),
    thumbnailUrl: String(input.thumbnailUrl || input.imageUrl || '').trim(),
    location: String(input.location || '').trim(),
    duration: String(input.duration || '').trim(),
    result: String(input.result || '').trim(),
    featured: Boolean(input.featured),
    displayOrder: Number(input.displayOrder) || 0,
    active: input.active !== false,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function normalizeSeoSettings(input = {}, defaults = {}) {
  const pages = { ...(defaults.pages || {}), ...(input.pages || {}) };
  const normalizedPages = {};
  Object.keys(pages).forEach((key) => {
    normalizedPages[key] = normalizeSeoBlock(pages[key]);
  });
  return {
    id: input.id || 'main',
    pages: normalizedPages,
    updatedAt: input.updatedAt || new Date().toISOString(),
  };
}

export function publicService(service) {
  if (!service || service.active === false) return null;
  const { updatedAt, ...rest } = service;
  return rest;
}

export function publicGalleryItem(item) {
  if (!item || item.active === false) return null;
  const { updatedAt, ...rest } = item;
  return rest;
}
