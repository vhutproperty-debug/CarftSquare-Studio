import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_ABOUT_CONTENT,
  DEFAULT_FAQS,
  DEFAULT_GALLERY_CATEGORIES,
  DEFAULT_GALLERY_ITEMS,
  DEFAULT_RENTAL_SUB_SERVICES,
  DEFAULT_SEO_SETTINGS,
  DEFAULT_SERVICES,
} from '@/lib/cms/defaults';
import {
  normalizeAboutContent,
  normalizeGalleryCategory,
  normalizeGalleryItem,
  normalizeSeoSettings,
  normalizeService,
  publicGalleryItem,
  publicService,
  slugify,
} from '@/lib/cms/normalize';

export async function ensureCmsIndexes(db) {
  await db.collection('about_content').createIndex({ id: 1 }, { unique: true });
  await db.collection('services').createIndex({ id: 1 }, { unique: true });
  await db.collection('services').createIndex({ slug: 1 }, { unique: true });
  await db.collection('services').createIndex({ displayOrder: 1 });
  await db.collection('services').createIndex({ active: 1 });
  await db.collection('service_categories').createIndex({ id: 1 }, { unique: true });
  await db.collection('service_categories').createIndex({ slug: 1 }, { unique: true });
  await db.collection('gallery_items').createIndex({ id: 1 }, { unique: true });
  await db.collection('gallery_items').createIndex({ slug: 1 }, { unique: true });
  await db.collection('gallery_items').createIndex({ categoryId: 1 });
  await db.collection('gallery_items').createIndex({ featured: 1, displayOrder: 1 });
  await db.collection('gallery_items').createIndex({ active: 1 });
  await db.collection('gallery_categories').createIndex({ id: 1 }, { unique: true });
  await db.collection('gallery_categories').createIndex({ slug: 1 }, { unique: true });
  await db.collection('seo_settings').createIndex({ id: 1 }, { unique: true });
}

export async function seedCmsDefaults(db) {
  const now = new Date().toISOString();

  const aboutCount = await db.collection('about_content').countDocuments();
  if (aboutCount === 0) {
    await db.collection('about_content').insertOne({ ...DEFAULT_ABOUT_CONTENT, createdAt: now, updatedAt: now });
  }

  const serviceCount = await db.collection('services').countDocuments();
  if (serviceCount === 0) {
    const rentalService = DEFAULT_SERVICES.find((s) => s.slug === 'rental-interiors');
    const docs = DEFAULT_SERVICES.map((service) => ({
      ...service,
      subServices: service.isRentalModule ? DEFAULT_RENTAL_SUB_SERVICES : [],
      seo: {},
      createdAt: now,
      updatedAt: now,
    }));
    await db.collection('services').insertMany(docs, { ordered: false });
    void rentalService;
  }

  const catCount = await db.collection('gallery_categories').countDocuments();
  if (catCount === 0) {
    await db.collection('gallery_categories').insertMany(
      DEFAULT_GALLERY_CATEGORIES.map((c) => ({ ...c, createdAt: now, updatedAt: now })),
      { ordered: false },
    );
  }

  const galleryCount = await db.collection('gallery_items').countDocuments();
  if (galleryCount === 0) {
    await db.collection('gallery_items').insertMany(
      DEFAULT_GALLERY_ITEMS.map((item) => ({ ...item, createdAt: now, updatedAt: now })),
      { ordered: false },
    );
  }

  const seoCount = await db.collection('seo_settings').countDocuments();
  if (seoCount === 0) {
    await db.collection('seo_settings').insertOne({ ...DEFAULT_SEO_SETTINGS, createdAt: now, updatedAt: now });
  }
}

async function getAboutDoc(db) {
  const doc = await db.collection('about_content').findOne({ id: 'main' }, { projection: { _id: 0 } });
  return normalizeAboutContent(doc || DEFAULT_ABOUT_CONTENT, DEFAULT_ABOUT_CONTENT);
}

async function getSeoDoc(db) {
  const doc = await db.collection('seo_settings').findOne({ id: 'main' }, { projection: { _id: 0 } });
  return normalizeSeoSettings(doc || DEFAULT_SEO_SETTINGS, DEFAULT_SEO_SETTINGS);
}

export async function getPublicAbout(db) {
  await seedCmsDefaults(db);
  const about = await getAboutDoc(db);
  return { about };
}

export async function getPublicSeo(db, pageKey = 'home') {
  await seedCmsDefaults(db);
  const seo = await getSeoDoc(db);
  return { seo: seo.pages[pageKey] || seo.pages.home, all: seo };
}

export async function getPublicServices(db, { activeOnly = true } = {}) {
  await seedCmsDefaults(db);
  const query = activeOnly ? { active: { $ne: false } } : {};
  const services = await db.collection('services')
    .find(query, { projection: { _id: 0 } })
    .sort({ displayOrder: 1, name: 1 })
    .toArray();
  return {
    services: services.map(publicService).filter(Boolean),
  };
}

export async function getPublicServiceBySlug(db, slug) {
  await seedCmsDefaults(db);
  const service = await db.collection('services').findOne(
    { slug, active: { $ne: false } },
    { projection: { _id: 0 } },
  );
  if (!service) return null;
  return publicService(service);
}

export async function getPublicRentalInteriors(db) {
  await seedCmsDefaults(db);
  const service = await db.collection('services').findOne(
    { slug: 'rental-interiors' },
    { projection: { _id: 0 } },
  );
  const seo = await getSeoDoc(db);
  return {
    service: service ? publicService(service) : null,
    subServices: (service?.subServices || DEFAULT_RENTAL_SUB_SERVICES).filter((s) => s.active !== false),
    seo: seo.pages.rentalInteriors || seo.pages.home,
  };
}

export async function getPublicGallery(db, request) {
  await seedCmsDefaults(db);
  const { searchParams } = new URL(request.url);
  const featured = searchParams.get('featured');
  const category = searchParams.get('category');
  const mediaType = searchParams.get('mediaType');
  const query = { active: { $ne: false } };

  if (featured === 'true') query.featured = true;
  if (category && category !== 'All') {
    query.$or = [{ categoryId: category }, { category: category }];
  }
  if (mediaType === 'image' || mediaType === 'video') query.mediaType = mediaType;

  const [items, categories] = await Promise.all([
    db.collection('gallery_items').find(query, { projection: { _id: 0 } }).sort({ displayOrder: 1, title: 1 }).limit(200).toArray(),
    db.collection('gallery_categories').find({ active: { $ne: false } }, { projection: { _id: 0 } }).sort({ displayOrder: 1 }).toArray(),
  ]);

  return {
    items: items.map(publicGalleryItem).filter(Boolean),
    categories,
  };
}

export async function getPublicFaqs() {
  return { faqs: DEFAULT_FAQS };
}

export async function getPublicProjectsFromDb(db) {
  await seedCmsDefaults(db);
  const items = await db.collection('gallery_items')
    .find({ active: { $ne: false }, featured: true }, { projection: { _id: 0 } })
    .sort({ displayOrder: 1 })
    .limit(12)
    .toArray();

  return {
    projects: items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      location: item.location,
      duration: item.duration,
      image: item.thumbnailUrl || item.imageUrl,
      result: item.result || item.description,
      mediaType: item.mediaType,
      videoUrl: item.videoUrl,
      description: item.description,
    })),
  };
}

// Admin handlers
export async function adminGetAbout(db) {
  await seedCmsDefaults(db);
  return { about: await getAboutDoc(db) };
}

export async function adminSaveAbout(db, body) {
  const about = normalizeAboutContent(body.about || body, DEFAULT_ABOUT_CONTENT);
  about.updatedAt = new Date().toISOString();
  await db.collection('about_content').updateOne(
    { id: 'main' },
    { $set: about, $setOnInsert: { createdAt: about.updatedAt } },
    { upsert: true },
  );
  return { about, message: 'About content saved.' };
}

export async function adminGetServices(db) {
  await seedCmsDefaults(db);
  const services = await db.collection('services').find({}, { projection: { _id: 0 } }).sort({ displayOrder: 1 }).toArray();
  return { services };
}

export async function adminSaveService(db, body) {
  const normalized = normalizeService(body.service || body);
  if (!normalized) return { error: 'Service name is required.', status: 400 };

  normalized.updatedAt = new Date().toISOString();
  await db.collection('services').updateOne(
    { id: normalized.id },
    { $set: normalized, $setOnInsert: { createdAt: normalized.updatedAt } },
    { upsert: true },
  );
  return { service: normalized, message: 'Service saved.' };
}

export async function adminDeleteService(db, id) {
  if (!id) return { error: 'Service id required.', status: 400 };
  const result = await db.collection('services').deleteOne({ id });
  return { deleted: result.deletedCount === 1, message: 'Service deleted.' };
}

export async function adminReorderServices(db, body) {
  const order = Array.isArray(body.order) ? body.order : [];
  for (let i = 0; i < order.length; i += 1) {
    await db.collection('services').updateOne(
      { id: order[i] },
      { $set: { displayOrder: i + 1, updatedAt: new Date().toISOString() } },
    );
  }
  return { message: 'Services reordered.' };
}

export async function adminGetRentalInteriors(db) {
  await seedCmsDefaults(db);
  const service = await db.collection('services').findOne({ slug: 'rental-interiors' }, { projection: { _id: 0 } });
  return { service: service || null };
}

export async function adminSaveRentalInteriors(db, body) {
  const service = await db.collection('services').findOne({ slug: 'rental-interiors' });
  if (!service) return { error: 'Rental interiors service not found.', status: 404 };

  const updates = {
    name: String(body.name || service.name).trim(),
    shortDescription: String(body.shortDescription || service.shortDescription || '').trim(),
    description: String(body.description || service.description || '').trim(),
    heroImage: String(body.heroImage || service.heroImage || '').trim(),
    galleryImages: Array.isArray(body.galleryImages) ? body.galleryImages : service.galleryImages,
    features: Array.isArray(body.features) ? body.features : service.features,
    active: body.active !== false,
    subServices: Array.isArray(body.subServices) ? body.subServices.map((s, i) => ({
      id: String(s.id || slugify(s.name)).trim(),
      name: String(s.name || '').trim(),
      description: String(s.description || '').trim(),
      displayOrder: Number(s.displayOrder) || i + 1,
      active: s.active !== false,
    })).filter((s) => s.name) : service.subServices,
    seo: body.seo || service.seo || {},
    updatedAt: new Date().toISOString(),
  };

  await db.collection('services').updateOne({ slug: 'rental-interiors' }, { $set: updates });
  const updated = await db.collection('services').findOne({ slug: 'rental-interiors' }, { projection: { _id: 0 } });
  return { service: updated, message: 'Rental interiors updated.' };
}

export async function adminGetGallery(db) {
  await seedCmsDefaults(db);
  const [items, categories] = await Promise.all([
    db.collection('gallery_items').find({}, { projection: { _id: 0 } }).sort({ displayOrder: 1 }).toArray(),
    db.collection('gallery_categories').find({}, { projection: { _id: 0 } }).sort({ displayOrder: 1 }).toArray(),
  ]);
  return { items, categories };
}

export async function adminSaveGalleryItem(db, body) {
  const normalized = normalizeGalleryItem(body.item || body);
  if (!normalized) return { error: 'Gallery item title is required.', status: 400 };

  normalized.updatedAt = new Date().toISOString();
  await db.collection('gallery_items').updateOne(
    { id: normalized.id },
    { $set: normalized, $setOnInsert: { createdAt: normalized.updatedAt } },
    { upsert: true },
  );
  return { item: normalized, message: 'Gallery item saved.' };
}

export async function adminDeleteGalleryItem(db, id) {
  if (!id) return { error: 'Item id required.', status: 400 };
  const result = await db.collection('gallery_items').deleteOne({ id });
  return { deleted: result.deletedCount === 1, message: 'Gallery item deleted.' };
}

export async function adminReorderGallery(db, body) {
  const order = Array.isArray(body.order) ? body.order : [];
  for (let i = 0; i < order.length; i += 1) {
    await db.collection('gallery_items').updateOne(
      { id: order[i] },
      { $set: { displayOrder: i + 1, updatedAt: new Date().toISOString() } },
    );
  }
  return { message: 'Gallery reordered.' };
}

export async function adminSaveGalleryCategory(db, body) {
  const normalized = normalizeGalleryCategory(body.category || body);
  if (!normalized) return { error: 'Category name is required.', status: 400 };

  normalized.updatedAt = new Date().toISOString();
  await db.collection('gallery_categories').updateOne(
    { id: normalized.id },
    { $set: normalized, $setOnInsert: { createdAt: normalized.updatedAt } },
    { upsert: true },
  );
  return { category: normalized, message: 'Gallery category saved.' };
}

export async function adminGetSeo(db) {
  await seedCmsDefaults(db);
  return { seo: await getSeoDoc(db) };
}

export async function adminSaveSeo(db, body) {
  const seo = normalizeSeoSettings(body.seo || body, DEFAULT_SEO_SETTINGS);
  seo.updatedAt = new Date().toISOString();
  await db.collection('seo_settings').updateOne(
    { id: 'main' },
    { $set: seo, $setOnInsert: { createdAt: seo.updatedAt } },
    { upsert: true },
  );
  return { seo, message: 'SEO settings saved.' };
}

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

export async function adminUploadMedia(request) {
  const formData = await request.formData();
  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return { error: 'File is required.', status: 400 };
  }

  const mimeType = file.type || 'application/octet-stream';
  if (!ALLOWED_MEDIA_TYPES.includes(mimeType)) {
    return { error: `Unsupported file type: ${mimeType}`, status: 400 };
  }

  const maxSize = mimeType.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { error: 'File too large.', status: 400 };
  }

  const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'bin';
  const filename = `${uuidv4()}.${ext}`;
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  const url = `/uploads/${filename}`;
  const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';

  return {
    url,
    mediaType,
    filename,
    size: file.size,
    message: 'File uploaded successfully.',
  };
}

export async function cmsServicesForPricing(db) {
  await seedCmsDefaults(db);
  const services = await db.collection('services')
    .find({ active: { $ne: false } }, { projection: { _id: 0 } })
    .sort({ displayOrder: 1 })
    .toArray();

  return services.map((s) => ({
    id: s.slug,
    title: s.name,
    price: s.priceLabel,
    icon: s.icon,
    description: s.shortDescription,
    active: s.active !== false,
    baseRate: s.baseRate || 450,
  }));
}
