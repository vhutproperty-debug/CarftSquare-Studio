import { NextResponse } from 'next/server';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import { getDb as connectDb, getMongoUrl } from '@/lib/mongodb';
import { DEFAULT_FAQS, DEFAULT_PRICING_SETTINGS } from '@/lib/cms/defaults';
import {
  adminDeleteGalleryItem,
  adminDeleteService,
  adminGetAbout,
  adminGetGallery,
  adminGetRentalInteriors,
  adminGetSeo,
  adminGetServices,
  adminReorderGallery,
  adminReorderServices,
  adminSaveAbout,
  adminSaveGalleryCategory,
  adminSaveGalleryItem,
  adminSaveRentalInteriors,
  adminSaveSeo,
  adminSaveService,
  adminUploadMedia,
  ensureCmsIndexes,
  getPublicAbout,
  getPublicGallery,
  getPublicProjectsFromDb,
  getPublicRentalInteriors,
  getPublicSeo,
  getPublicServiceBySlug,
  getPublicServices,
  seedCmsDefaults,
} from '@/lib/cms/handlers';

export const dynamic = 'force-dynamic';

let cmsInitialized = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SESSION_COOKIE = 'bb_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 12;
const LEAD_NOTIFICATION_EMAIL = BRAND.emailTo;
const EMAIL_SUBJECT = `New Lead - ${BRAND.name} Interior Solutions`;
const LOGO_URL = absoluteLogoUrl;

const defaultPricingSettings = DEFAULT_PRICING_SETTINGS;

function getDefaultServiceRates() {
  return defaultPricingSettings.services.reduce((acc, service) => {
    acc[service.id] = service.baseRate || 450;
    return acc;
  }, {});
}

const defaultPaintShades = [
  { brand: 'Asian Paints', shadeName: 'Ivory Palace', shadeCode: 'AP-WH-101', hexColor: '#F4EFE3', category: 'Whites' },
  { brand: 'Asian Paints', shadeName: 'Warm Sand', shadeCode: 'AP-BG-214', hexColor: '#D8C3A5', category: 'Beige' },
  { brand: 'Asian Paints', shadeName: 'Royal Grey', shadeCode: 'AP-GR-331', hexColor: '#8D9398', category: 'Grey' },
  { brand: 'Asian Paints', shadeName: 'Ocean Crest', shadeCode: 'AP-BL-440', hexColor: '#3F6F8F', category: 'Blue' },
  { brand: 'Asian Paints', shadeName: 'Velvet Truffle', shadeCode: 'AP-LX-718', hexColor: '#6F4E37', category: 'Luxury' },
  { brand: 'Nerolac', shadeName: 'Pearl Mist', shadeCode: 'NR-WH-052', hexColor: '#F6F3EA', category: 'Whites' },
  { brand: 'Nerolac', shadeName: 'Urban Taupe', shadeCode: 'NR-BG-188', hexColor: '#B9A58F', category: 'Beige' },
  { brand: 'Nerolac', shadeName: 'Slate Motion', shadeCode: 'NR-GR-402', hexColor: '#6E7478', category: 'Grey' },
  { brand: 'Nerolac', shadeName: 'Monsoon Blue', shadeCode: 'NR-BL-276', hexColor: '#315D7C', category: 'Blue' },
  { brand: 'Nerolac', shadeName: 'Exterior Terracotta', shadeCode: 'NR-EX-612', hexColor: '#B45F45', category: 'Exterior' },
  { brand: 'Berger', shadeName: 'Cloud White', shadeCode: 'BG-WH-009', hexColor: '#FAF8F1', category: 'Whites' },
  { brand: 'Berger', shadeName: 'Almond Beige', shadeCode: 'BG-BG-144', hexColor: '#CDBA96', category: 'Beige' },
  { brand: 'Berger', shadeName: 'Graphite Silk', shadeCode: 'BG-GR-509', hexColor: '#565D63', category: 'Grey' },
  { brand: 'Berger', shadeName: 'Imperial Indigo', shadeCode: 'BG-BL-702', hexColor: '#253B69', category: 'Luxury' },
  { brand: 'Berger', shadeName: 'Sandstone Texture', shadeCode: 'BG-TX-833', hexColor: '#A9825A', category: 'Texture-inspired' },
  { brand: 'Dulux', shadeName: 'Cotton Whisper', shadeCode: 'DX-WH-018', hexColor: '#F7F2E8', category: 'Whites' },
  { brand: 'Dulux', shadeName: 'Greige Estate', shadeCode: 'DX-BG-288', hexColor: '#AFA295', category: 'Beige' },
  { brand: 'Dulux', shadeName: 'Smoke Grey', shadeCode: 'DX-GR-340', hexColor: '#747A7C', category: 'Grey' },
  { brand: 'Dulux', shadeName: 'Coastal Blue', shadeCode: 'DX-BL-476', hexColor: '#2E6789', category: 'Blue' },
  { brand: 'Dulux', shadeName: 'Metallic Champagne', shadeCode: 'DX-TX-920', hexColor: '#C8B084', category: 'Texture-inspired' },
];

const shadeBrands = ['Asian Paints', 'Nerolac', 'Berger', 'Dulux'];
const shadeCategories = ['Whites', 'Beige', 'Grey', 'Blue', 'Luxury', 'Exterior', 'Texture-inspired'];


function json(data, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders });
}

function getPathSegments(context) {
  return context?.params?.path || [];
}

function getSessionSecret() {
  const mongoUrl = getMongoUrl();
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || `${mongoUrl || 'local'}::${BRAND.sessionSuffix}`;
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash = '') {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === candidate.length && timingSafeEqual(expected, candidate);
}

function signSession(admin) {
  const payload = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role || 'admin',
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readSession(request) {
  const token = request.cookies?.get(SESSION_COOKIE)?.value;
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = createHmac('sha256', getSessionSecret()).update(encoded).digest('base64url');
  if (Buffer.from(signature).length !== Buffer.from(expected).length) return null;
  const valid = timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return null;
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!payload?.exp || payload.exp < Date.now() || payload.role !== 'admin') return null;
  return payload;
}

function setSessionCookie(response, admin) {
  response.cookies.set(SESSION_COOKIE, signSession(admin), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

function clearSessionCookie(response) {
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

async function requireAdmin(request) {
  const session = readSession(request);
  if (!session) return null;
  const db = await getDb();
  const admin = await db.collection('admins').findOne({ id: session.id, role: 'admin' }, { projection: { _id: 0, passwordHash: 0 } });
  return admin || null;
}

function safeAdmin(admin) {
  if (!admin) return null;
  const { passwordHash, _id, ...safe } = admin;
  return safe;
}

function escapePdfText(value = '') {
  return String(value).replace(/[₹]/g, 'Rs.').replace(/[\\()]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

function createSimplePdf(lines = []) {
  const content = [
    'BT',
    '/F1 20 Tf',
    '50 790 Td',
    `(CraftSquare Studio Quote) Tj`,
    '/F1 10 Tf',
    '0 -24 Td',
    `(Premium Interior Design & Solutions, Mumbai) Tj`,
    ...lines.flatMap((line) => ['0 -18 Td', `(${escapePdfText(line)}) Tj`]),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function buildQuoteLines(lead) {
  const estimate = lead?.estimate || {};
  return [
    `Quote ID: Q-${String(lead?.id || '').slice(0, 8).toUpperCase()}`,
    `Date: ${new Date().toLocaleDateString('en-IN')}`,
    `Customer: ${lead?.name || 'Customer'}`,
    `Phone: ${lead?.phone || '-'}`,
    `Location: ${lead?.location || 'Mumbai'}`,
    `Service: ${lead?.service || '-'}`,
    `Property: ${lead?.bhk || '-'} ${lead?.propertyType || ''}, ${lead?.area || '-'} sq.ft`,
    `Paint Quality: ${lead?.paintQuality || '-'}`,
    `Estimated Range: ${estimate.formattedRange || '-'}`,
    `Material Estimate: Rs. ${Number(estimate.materialEstimate || 0).toLocaleString('en-IN')}`,
    `Labor Estimate: Rs. ${Number(estimate.laborEstimate || 0).toLocaleString('en-IN')}`,
    `Timeline: ${estimate.timelineDays || '-'} days`,
    `Warranty: ${estimate.warranty || 'As per final scope'}`,
    'Note: Final quote depends on site measurement, surface condition, seepage repair and selected material system.',
  ];
}

function normalizePhone(phone = '') {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function mergePricingSettings(settings = {}) {
  const rates = getDefaultServiceRates();
  const savedServices = Array.isArray(settings.services) ? settings.services : [];
  const servicesById = savedServices.reduce((acc, service) => {
    if (service?.id) acc[service.id] = service;
    return acc;
  }, {});

  return {
    ...defaultPricingSettings,
    ...settings,
    services: defaultPricingSettings.services.map((service) => ({
      ...service,
      ...(servicesById[service.id] || {}),
      baseRate: parseNumber(servicesById[service.id]?.baseRate, rates[service.id] || service.baseRate || 450),
      active: servicesById[service.id]?.active !== false,
    })),
    qualityMultipliers: {
      ...defaultPricingSettings.qualityMultipliers,
      ...(settings.qualityMultipliers || {}),
    },
    freshMultiplier: parseNumber(settings.freshMultiplier, defaultPricingSettings.freshMultiplier),
    villaMultiplier: parseNumber(settings.villaMultiplier, defaultPricingSettings.villaMultiplier),
    commercialMultiplier: parseNumber(settings.commercialMultiplier, defaultPricingSettings.commercialMultiplier),
    materialPercent: parseNumber(settings.materialPercent, defaultPricingSettings.materialPercent),
    laborPercent: parseNumber(settings.laborPercent, defaultPricingSettings.laborPercent),
    repaintSqftPerDay: parseNumber(settings.repaintSqftPerDay, defaultPricingSettings.repaintSqftPerDay),
    freshSqftPerDay: parseNumber(settings.freshSqftPerDay, defaultPricingSettings.freshSqftPerDay),
  };
}

async function getPricingSettings(db) {
  const settings = await db.collection('settings').findOne({ key: 'pricing' }, { projection: { _id: 0 } });
  return mergePricingSettings(settings || defaultPricingSettings);
}

function publicServicesFromSettings(settings) {
  return (settings?.services || defaultPricingSettings.services)
    .filter((service) => service.active !== false)
    .map(({ baseRate, active, ...service }) => service);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(value = new Date()) {
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function buildNotificationHtml(payload) {
  const rows = [
    ['Customer name', payload.name || '-'],
    ['Phone number', payload.phone || '-'],
    ['Email address', payload.email || '-'],
    ['Service requested', payload.service || '-'],
    ['Message / details', payload.message || '-'],
    ['Date & time', formatDateTime(payload.createdAt || new Date())],
    ['Page / source', payload.source || '-'],
  ];

  return `
    <div style="font-family:Inter,Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a">
      <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0">
        <div style="background:#0f172a;color:white;padding:24px;display:flex;align-items:center;gap:16px">
          <img src="${LOGO_URL}" alt="${BRAND.name}" style="height:64px;width:auto;border-radius:12px;object-fit:contain" />
          <div><h1 style="margin:0;font-size:22px">New ${BRAND.name} Lead</h1><p style="margin:4px 0 0;color:#fed7aa">Interior Solutions Enquiry</p></div>
        </div>
        <div style="padding:24px">
          ${rows.map(([label, value]) => `<div style="padding:14px 0;border-bottom:1px solid #f1f5f9"><div style="font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:700">${escapeHtml(label)}</div><div style="margin-top:6px;font-size:16px;font-weight:700;white-space:pre-wrap">${escapeHtml(value)}</div></div>`).join('')}
        </div>
      </div>
    </div>`;
}

async function sendResendEmail(payload) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || BRAND.emailFrom,
      to: [process.env.EMAIL_TO || LEAD_NOTIFICATION_EMAIL],
      subject: EMAIL_SUBJECT,
      html: buildNotificationHtml(payload),
    }),
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.message || result?.error || `Resend API failed with ${response.status}`);
  }
  return result;
}

async function queueAndSendEmail(db, payload) {
  const now = new Date().toISOString();
  const notification = {
    id: uuidv4(),
    type: payload.type || 'lead',
    relatedId: payload.relatedId || '',
    to: process.env.EMAIL_TO || LEAD_NOTIFICATION_EMAIL,
    subject: EMAIL_SUBJECT,
    payload,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('email_notifications').insertOne(notification);
  try {
    const result = await sendResendEmail(payload);
    await db.collection('email_notifications').updateOne(
      { id: notification.id },
      { $set: { status: 'sent', attempts: 1, providerResult: result, sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    );
    return { status: 'sent', notificationId: notification.id };
  } catch (error) {
    await db.collection('email_notifications').updateOne(
      { id: notification.id },
      { $set: { status: 'failed', attempts: 1, failureReason: error.message, lastAttemptAt: new Date().toISOString(), updatedAt: new Date().toISOString() } },
    );
    return { status: 'failed', notificationId: notification.id, error: error.message };
  }
}

async function retryFailedEmailNotifications(db, limit = 10) {
  const failed = await db.collection('email_notifications').find({ status: 'failed', attempts: { $lt: 3 } }, { projection: { _id: 0 } }).sort({ createdAt: 1 }).limit(limit).toArray();
  let retried = 0;
  for (const item of failed) {
    try {
      const result = await sendResendEmail(item.payload);
      await db.collection('email_notifications').updateOne(
        { id: item.id },
        { $set: { status: 'sent', providerResult: result, sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, $inc: { attempts: 1 } },
      );
      retried += 1;
    } catch (error) {
      await db.collection('email_notifications').updateOne(
        { id: item.id },
        { $set: { failureReason: error.message, lastAttemptAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, $inc: { attempts: 1 } },
      );
    }
  }
  return retried;
}

async function getDb() {
  const db = await connectDb();
  if (!cmsInitialized) {
    await ensureCmsIndexes(db);
    await seedCmsDefaults(db);
    cmsInitialized = true;
  }
  return db;
}

function parseNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeShade(input = {}) {
  const brand = String(input.brand || '').trim();
  const shadeName = String(input.shadeName || input.name || '').trim();
  const shadeCode = String(input.shadeCode || input.code || '').trim();
  const hexColor = String(input.hexColor || input.hex || '').trim();
  const category = String(input.category || 'Luxury').trim();

  if (!brand || !shadeName || !shadeCode || !/^#[0-9A-Fa-f]{6}$/.test(hexColor)) {
    return null;
  }

  return {
    id: `${brand.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${shadeCode.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    brand,
    shadeName,
    shadeCode,
    hexColor,
    category: shadeCategories.includes(category) ? category : category,
    active: input.active !== false,
    updatedAt: new Date().toISOString(),
  };
}

async function ensureDefaultShades(db) {
  const count = await db.collection('paint_shades').countDocuments();
  if (count > 0) return;
  const now = new Date().toISOString();
  const docs = defaultPaintShades.map((shade) => ({ ...normalizeShade(shade), createdAt: now, updatedAt: now }));
  await db.collection('paint_shades').insertMany(docs, { ordered: false });
}

async function getShades(request) {
  const db = await getDb();
  await ensureDefaultShades(db);
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get('brand');
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const query = { active: true };

  if (brand && brand !== 'All') query.brand = brand;
  if (category && category !== 'All') query.category = category;
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [{ shadeName: regex }, { shadeCode: regex }, { brand: regex }, { category: regex }];
  }

  const shades = await db.collection('paint_shades').find(query, { projection: { _id: 0 } }).sort({ brand: 1, category: 1, shadeName: 1 }).limit(500).toArray();
  return json({ shades, brands: shadeBrands, categories: shadeCategories });
}

async function adminImportShades(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);

  const body = await request.json();
  const mode = body.mode === 'replace' ? 'replace' : 'upsert';
  const inputShades = Array.isArray(body.shades) ? body.shades : [];
  const normalized = inputShades.map(normalizeShade).filter(Boolean);
  if (normalized.length === 0) {
    return json({ error: 'No valid shades found. Required: shadeName, shadeCode, hexColor, brand, category.' }, 400);
  }

  const db = await getDb();
  const now = new Date().toISOString();
  if (mode === 'replace') {
    await db.collection('paint_shades').deleteMany({});
  }

  let imported = 0;
  for (const shade of normalized) {
    await db.collection('paint_shades').updateOne(
      { brand: shade.brand, shadeCode: shade.shadeCode },
      { $set: { ...shade, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    );
    imported += 1;
  }

  return json({ imported, mode, message: `${imported} paint shades imported successfully.` });
}

function calculateEstimate(payload = {}, settings = defaultPricingSettings) {
  const area = Math.max(parseNumber(payload.area, 650), 150);
  const propertyType = payload.propertyType || 'apartment';
  const bhk = payload.bhk || '2BHK';
  const quality = payload.paintQuality || 'premium';
  const projectType = payload.projectType || 'repaint';
  const service = payload.service || 'residential-interiors';
  const rates = getDefaultServiceRates();

  const serviceConfig = (settings.services || defaultPricingSettings.services).find((item) => item.id === service);
  const serviceBaseRate = parseNumber(serviceConfig?.baseRate, rates[service] || 450);
  const qualityMultiplier = settings.qualityMultipliers || defaultPricingSettings.qualityMultipliers;

  const projectMultiplier = projectType === 'fresh' ? parseNumber(settings.freshMultiplier, 1.38) : 1;
  const propertyMultiplier = propertyType === 'villa' ? parseNumber(settings.villaMultiplier, 1.18) : propertyType === 'commercial' ? parseNumber(settings.commercialMultiplier, 1.12) : 1;
  const bhkComplexity = bhk === '4BHK+' ? 1.14 : bhk === '3BHK' ? 1.08 : bhk === '1BHK' ? 0.93 : 1;
  const rate = serviceBaseRate * (parseNumber(qualityMultiplier[quality], 1)) * projectMultiplier * propertyMultiplier * bhkComplexity;
  const baseCost = area * rate;
  const low = Math.round((baseCost * 0.9) / 500) * 500;
  const high = Math.round((baseCost * 1.18) / 500) * 500;
  const material = Math.round(high * (parseNumber(settings.materialPercent, 58) / 100));
  const labor = Math.round(high * (parseNumber(settings.laborPercent, 34) / 100));
  const buffer = Math.max(high - material - labor, 0);
  const productionRate = projectType === 'fresh' ? parseNumber(settings.freshSqftPerDay, 280) : parseNumber(settings.repaintSqftPerDay, 380);
  const days = Math.max(2, Math.ceil(area / productionRate));

  return {
    input: { area, propertyType, bhk, paintQuality: quality, projectType, service },
    estimateLow: low,
    estimateHigh: high,
    formattedRange: `₹${low.toLocaleString('en-IN')} - ₹${high.toLocaleString('en-IN')}`,
    materialEstimate: material,
    laborEstimate: labor,
    bufferEstimate: buffer,
    timelineDays: days,
    recommendation: quality === 'luxury'
      ? 'Luxury interior package with premium finishes, imported materials and designer styling.'
      : quality === 'premium'
        ? 'Premium interior package with branded materials, modular solutions and professional execution.'
        : quality === 'economy'
          ? 'Budget-friendly interior package for rental and quick possession projects.'
          : 'Standard interior package for durable, well-designed everyday spaces.',
    warranty: service.includes('modular') || service.includes('kitchen') || service.includes('wardrobe')
      ? settings.waterproofingWarranty
      : settings.standardWarranty,
  };
}

async function createLead(request) {
  const db = await getDb();
  const body = await request.json();
  if (String(body.website || body.companyWebsite || '').trim()) {
    return json({ message: `Thank you for contacting ${BRAND.name}. We will get back to you shortly.` }, 201);
  }
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const service = String(body.service || 'residential-interiors').trim();

  if (!name || phone.length < 8) {
    return json({ error: 'Name and valid phone number are required.' }, 400);
  }

  const estimate = body.estimate || calculateEstimate(body, await getPricingSettings(db));
  const now = new Date().toISOString();
  const lead = {
    id: uuidv4(),
    name,
    phone,
    email: String(body.email || '').trim(),
    city: 'Mumbai',
    location: String(body.location || '').trim(),
    service,
    propertyType: body.propertyType || 'apartment',
    bhk: body.bhk || '2BHK',
    area: parseNumber(body.area, 650),
    paintQuality: body.paintQuality || 'premium',
    projectType: body.projectType || 'repaint',
    preferredSlot: body.preferredSlot || 'Today / Tomorrow',
    notes: String(body.notes || '').trim(),
    source: body.source || 'website',
    status: 'new',
    assignedVendor: '',
    paymentStatus: 'not_started',
    emailNotification: { status: 'pending', notificationId: '', failureReason: '' },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('leads').insertOne(lead);
  const emailResult = await queueAndSendEmail(db, {
    type: 'lead',
    relatedId: lead.id,
    name: lead.name,
    phone: lead.phone,
    email: lead.email,
    service: lead.service,
    message: lead.notes || `Location: ${lead.location || 'Mumbai'}\nProperty: ${lead.bhk}, ${lead.area} sq.ft\nEstimate: ${lead.estimate?.formattedRange || '-'}`,
    source: lead.source,
    createdAt: lead.createdAt,
  });
  lead.emailNotification = { status: emailResult.status, notificationId: emailResult.notificationId, failureReason: emailResult.error || '' };
  await db.collection('leads').updateOne({ id: lead.id }, { $set: { emailNotification: lead.emailNotification } });
  await retryFailedEmailNotifications(db, 3);
  const { _id, ...safeLead } = lead;
  return json({ lead: safeLead, message: `Thank you for contacting ${BRAND.name}. We will get back to you shortly.` }, 201);
}

async function getLeads(request) {
  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const query = status && status !== 'all' ? { status } : {};
  const leads = await db.collection('leads').find(query, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
  return json({ leads });
}

async function updateLead(request, id) {
  if (!id) {
    return json({ error: 'Lead id is required.' }, 400);
  }

  const db = await getDb();
  const body = await request.json();
  const allowed = ['status', 'assignedVendor', 'paymentStatus', 'notes', 'preferredSlot'];
  const updates = {};

  allowed.forEach((key) => {
    if (body[key] !== undefined) {
      updates[key] = body[key];
    }
  });

  updates.updatedAt = new Date().toISOString();
  const result = await db.collection('leads').findOneAndUpdate(
    { id },
    { $set: updates },
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  if (!result) {
    return json({ error: 'Lead not found.' }, 404);
  }

  return json({ lead: result, message: 'Lead updated.' });
}

function normalizeServicesOffered(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function createVendorRequest(request) {
  const db = await getDb();
  const body = await request.json();
  if (String(body.website || body.companyWebsite || '').trim()) {
    return json({ message: `Thank you for contacting ${BRAND.name}. We will get back to you shortly.` }, 201);
  }
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const cityArea = String(body.cityArea || body.location || '').trim();
  const servicesOffered = normalizeServicesOffered(body.servicesOffered);

  if (!name || phone.length < 8 || !cityArea || servicesOffered.length === 0) {
    return json({ error: 'Name, valid phone, city/area and at least one service are required.' }, 400);
  }

  const now = new Date().toISOString();
  const vendor = {
    id: uuidv4(),
    name,
    phone,
    email: String(body.email || '').trim().toLowerCase(),
    cityArea,
    servicesOffered,
    yearsExperience: parseNumber(body.yearsExperience, 0),
    teamSize: parseNumber(body.teamSize, 1),
    gstPan: String(body.gstPan || '').trim(),
    portfolioNotes: String(body.portfolioNotes || '').trim(),
    status: 'new',
    adminNotes: '',
    source: body.source || 'vendor_registration_section',
    emailNotification: { status: 'pending', notificationId: '', failureReason: '' },
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('vendors').insertOne(vendor);
  const emailResult = await queueAndSendEmail(db, {
    type: 'vendor',
    relatedId: vendor.id,
    name: vendor.name,
    phone: vendor.phone,
    email: vendor.email,
    service: `Vendor association: ${vendor.servicesOffered.join(', ')}`,
    message: `City/Area: ${vendor.cityArea}\nExperience: ${vendor.yearsExperience} years\nTeam size: ${vendor.teamSize}\nGST/PAN: ${vendor.gstPan || '-'}\nPortfolio: ${vendor.portfolioNotes || '-'}`,
    source: vendor.source,
    createdAt: vendor.createdAt,
  });
  vendor.emailNotification = { status: emailResult.status, notificationId: emailResult.notificationId, failureReason: emailResult.error || '' };
  await db.collection('vendors').updateOne({ id: vendor.id }, { $set: { emailNotification: vendor.emailNotification } });
  await retryFailedEmailNotifications(db, 3);
  const { _id, ...safeVendor } = vendor;
  return json({ vendor: safeVendor, message: `Thank you for contacting ${BRAND.name}. We will get back to you shortly.` }, 201);
}

async function adminVendors(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const db = await getDb();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const query = status && status !== 'all' ? { status } : {};
  const vendors = await db.collection('vendors').find(query, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(250).toArray();
  return json({ vendors });
}

async function createEnquiryEvent(request) {
  const db = await getDb();
  const body = await request.json();
  const now = new Date().toISOString();
  const event = {
    id: uuidv4(),
    type: body.type || 'whatsapp_click',
    name: String(body.name || 'Website visitor').trim(),
    phone: String(body.phone || '').trim(),
    email: String(body.email || '').trim(),
    service: String(body.service || body.label || 'WhatsApp / call enquiry').trim(),
    message: String(body.message || 'Visitor clicked WhatsApp/call enquiry button.').trim(),
    source: String(body.source || 'website').trim(),
    createdAt: now,
  };
  await db.collection('enquiry_events').insertOne(event);
  await queueAndSendEmail(db, { ...event, relatedId: event.id });
  return json({ tracked: true });
}

async function retryEmailNotificationsAdmin(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const db = await getDb();
  const retried = await retryFailedEmailNotifications(db, 25);
  return json({ retried, message: `${retried} failed email notifications retried.` });
}

async function updateVendorAdmin(request, id) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  if (!id) return json({ error: 'Vendor id is required.' }, 400);

  const db = await getDb();
  const body = await request.json();
  const allowedStatuses = ['new', 'contacted', 'approved', 'rejected'];
  const updates = {};

  if (body.status !== undefined) {
    if (!allowedStatuses.includes(body.status)) {
      return json({ error: 'Invalid vendor status.' }, 400);
    }
    updates.status = body.status;
  }

  if (body.adminNotes !== undefined) {
    updates.adminNotes = String(body.adminNotes || '').trim();
  }

  updates.updatedAt = new Date().toISOString();
  const result = await db.collection('vendors').findOneAndUpdate(
    { id },
    { $set: updates },
    { returnDocument: 'after', projection: { _id: 0 } },
  );

  if (!result) return json({ error: 'Vendor request not found.' }, 404);
  return json({ vendor: result, message: 'Vendor request updated.' });
}

async function dashboard() {
  const db = await getDb();
  const leads = await db.collection('leads').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(100).toArray();
  const statusCounts = leads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});
  const potentialRevenue = leads.reduce((sum, lead) => sum + (lead?.estimate?.estimateHigh || 0), 0);
  const completed = statusCounts.completed || 0;

  return json({
    stats: {
      totalLeads: leads.length,
      newLeads: statusCounts.new || 0,
      scheduled: statusCounts.scheduled || 0,
      inProgress: statusCounts.in_progress || 0,
      completed,
      potentialRevenue,
      conversionRate: leads.length ? Math.round((completed / leads.length) * 100) : 0,
    },
    statusCounts,
    latestLeads: leads.slice(0, 8),
  });
}

async function authStatus(request) {
  const db = await getDb();
  const hasAdmin = await db.collection('admins').countDocuments({ role: 'admin' }) > 0;
  const sessionAdmin = await requireAdmin(request);
  return json({ hasAdmin, authenticated: Boolean(sessionAdmin), user: safeAdmin(sessionAdmin) });
}

async function setupAdmin(request) {
  const db = await getDb();
  const existingAdmins = await db.collection('admins').countDocuments({ role: 'admin' });
  if (existingAdmins > 0) {
    return json({ error: 'Admin already exists. Please login.' }, 409);
  }

  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || `${BRAND.name} Admin`).trim();

  if (!email.includes('@') || password.length < 8) {
    return json({ error: 'Valid email and minimum 8 character password are required.' }, 400);
  }

  const now = new Date().toISOString();
  const admin = {
    id: uuidv4(),
    email,
    name,
    role: 'admin',
    passwordHash: hashPassword(password),
    createdAt: now,
    updatedAt: now,
  };

  await db.collection('admins').insertOne(admin);
  const response = NextResponse.json({ user: safeAdmin(admin), message: 'First admin created and logged in.' }, { status: 201, headers: corsHeaders });
  return setSessionCookie(response, admin);
}

async function loginAdmin(request) {
  const db = await getDb();
  const body = await request.json();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const admin = await db.collection('admins').findOne({ email, role: 'admin' });

  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return json({ error: 'Invalid admin credentials.' }, 401);
  }

  const response = NextResponse.json({ user: safeAdmin(admin), message: 'Admin logged in.' }, { headers: corsHeaders });
  return setSessionCookie(response, admin);
}

async function resetAdminPassword(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);

  const body = await request.json();
  const password = String(body.password || '');
  if (password.length < 8) {
    return json({ error: 'New password must be at least 8 characters.' }, 400);
  }

  const db = await getDb();
  const updatedAt = new Date().toISOString();
  await db.collection('admins').updateOne(
    { id: admin.id, role: 'admin' },
    { $set: { passwordHash: hashPassword(password), updatedAt, passwordResetAt: updatedAt } },
  );
  return json({ message: 'Password reset successfully.' });
}

async function adminPricing(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const db = await getDb();
  const pricing = await getPricingSettings(db);
  return json({ pricing });
}

function sanitizePricingPayload(body = {}) {
  const merged = mergePricingSettings(body);
  return {
    key: 'pricing',
    services: merged.services.map((service) => ({
      id: service.id,
      title: String(service.title || '').trim() || service.id,
      price: String(service.price || '').trim(),
      icon: service.icon || 'Paintbrush',
      description: String(service.description || '').trim(),
      active: service.active !== false,
      baseRate: Math.max(0, parseNumber(service.baseRate, getDefaultServiceRates()[service.id] || 450)),
    })),
    qualityMultipliers: {
      economy: Math.max(0, parseNumber(merged.qualityMultipliers.economy, 0.82)),
      standard: Math.max(0, parseNumber(merged.qualityMultipliers.standard, 1)),
      premium: Math.max(0, parseNumber(merged.qualityMultipliers.premium, 1.28)),
      luxury: Math.max(0, parseNumber(merged.qualityMultipliers.luxury, 1.65)),
    },
    freshMultiplier: Math.max(0, parseNumber(merged.freshMultiplier, 1.38)),
    villaMultiplier: Math.max(0, parseNumber(merged.villaMultiplier, 1.18)),
    commercialMultiplier: Math.max(0, parseNumber(merged.commercialMultiplier, 1.12)),
    materialPercent: Math.min(100, Math.max(0, parseNumber(merged.materialPercent, 58))),
    laborPercent: Math.min(100, Math.max(0, parseNumber(merged.laborPercent, 34))),
    repaintSqftPerDay: Math.max(1, parseNumber(merged.repaintSqftPerDay, 380)),
    freshSqftPerDay: Math.max(1, parseNumber(merged.freshSqftPerDay, 280)),
    standardWarranty: String(merged.standardWarranty || defaultPricingSettings.standardWarranty).trim(),
    waterproofingWarranty: String(merged.waterproofingWarranty || defaultPricingSettings.waterproofingWarranty).trim(),
    updatedAt: new Date().toISOString(),
  };
}

async function saveAdminPricing(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const body = await request.json();
  const db = await getDb();
  const pricing = sanitizePricingPayload(body.pricing || body);
  await db.collection('settings').updateOne({ key: 'pricing' }, { $set: pricing }, { upsert: true });
  return json({ pricing, message: 'Pricing settings saved.' });
}

async function resetAdminPricing(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const db = await getDb();
  const pricing = { ...defaultPricingSettings, updatedAt: new Date().toISOString() };
  await db.collection('settings').updateOne({ key: 'pricing' }, { $set: pricing }, { upsert: true });
  return json({ pricing, message: 'Pricing reset to defaults.' });
}

async function logoutAdmin() {
  const response = NextResponse.json({ message: 'Logged out.' }, { headers: corsHeaders });
  return clearSessionCookie(response);
}

async function adminLeads(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const db = await getDb();
  const leads = await db.collection('leads').find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).limit(250).toArray();
  return json({ leads, admin });
}

async function adminDashboard(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  return dashboard();
}

async function updateLeadAdmin(request, id) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  return updateLead(request, id);
}

async function quotePdf(request, leadId) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);
  const db = await getDb();
  const lead = await db.collection('leads').findOne({ id: leadId }, { projection: { _id: 0 } });
  if (!lead) return json({ error: 'Lead not found.' }, 404);
  const quote = {
    id: uuidv4(),
    leadId,
    quoteNumber: `Q-${String(leadId).slice(0, 8).toUpperCase()}`,
    generatedBy: admin.id,
    lines: buildQuoteLines(lead),
    createdAt: new Date().toISOString(),
  };
  await db.collection('quotes').insertOne(quote);
  const pdf = createSimplePdf(quote.lines);
  return new NextResponse(pdf, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="craftsquare-${quote.quoteNumber}.pdf"`,
    },
  });
}

async function sendWhatsAppQuote(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);

  if (!process.env.WHATSAPP_PHONE_NUMBER_ID || !process.env.WHATSAPP_ACCESS_TOKEN) {
    return json({
      error: 'WhatsApp Business API is not configured. Add WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN to enable automation.',
      integrationConfigured: false,
    }, 503);
  }

  const body = await request.json();
  const db = await getDb();
  const lead = await db.collection('leads').findOne({ id: body.leadId }, { projection: { _id: 0 } });
  if (!lead) return json({ error: 'Lead not found.' }, 404);

  const to = normalizePhone(lead.phone);
  const message = `Hi ${lead.name}, your ${BRAND.name} ${lead.service} estimate for ${lead.location || 'Mumbai'} is ${lead.estimate?.formattedRange || 'ready'}. Reply YES to schedule your free design consultation.`;
  const response = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: message },
    }),
  });
  const result = await response.json();
  await db.collection('whatsapp_messages').insertOne({ id: uuidv4(), leadId: lead.id, to, message, result, ok: response.ok, createdAt: new Date().toISOString() });
  if (!response.ok) return json({ error: 'WhatsApp API rejected the message.', details: result }, 502);
  return json({ sent: true, result });
}

async function visualizerTransform(request) {
  const admin = await requireAdmin(request);
  if (!admin) return json({ error: 'Admin authentication required.' }, 401);

  if (!process.env.STABILITY_API_KEY && !process.env.CLARIFAI_API_KEY) {
    return json({
      error: 'AI visualizer provider is not configured. Add STABILITY_API_KEY for AI room transformation or CLARIFAI_API_KEY for AI color extraction.',
      integrationConfigured: false,
    }, 503);
  }

  return json({
    message: 'AI visualizer credentials detected. Provider-specific image transformation is ready for the next configuration pass.',
    integrationConfigured: true,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request, context) {
  try {
    const path = getPathSegments(context);
    const route = path[0] || 'health';
    const db = await getDb();

    if (route === 'health') {
      return json({ ok: true, app: BRAND.appId, city: BRAND.city, timestamp: new Date().toISOString() });
    }

    if (route === 'services') {
      if (path[1]) {
        const service = await getPublicServiceBySlug(db, path[1]);
        if (!service) return json({ error: 'Service not found.' }, 404);
        return json({ service });
      }
      const cmsServices = await getPublicServices(db);
      return json({ services: cmsServices.services.map((s) => ({
        id: s.slug,
        title: s.name,
        price: s.priceLabel,
        icon: s.icon,
        description: s.shortDescription,
        slug: s.slug,
        heroImage: s.heroImage,
      })) });
    }

    if (route === 'about') {
      return json(await getPublicAbout(db));
    }

    if (route === 'gallery') {
      return json(await getPublicGallery(db, request));
    }

    if (route === 'rental-interiors') {
      return json(await getPublicRentalInteriors(db));
    }

    if (route === 'seo') {
      return json(await getPublicSeo(db, path[1] || 'home'));
    }

    if (route === 'leads') {
      return getLeads(request);
    }

    if (route === 'dashboard') {
      return dashboard();
    }

    if (route === 'shades') {
      return getShades(request);
    }

    if (route === 'projects') {
      return json(await getPublicProjectsFromDb(db));
    }

    if (route === 'faqs') {
      return json({ faqs: DEFAULT_FAQS });
    }

    if (route === 'auth' && path[1] === 'status') {
      return authStatus(request);
    }

    if (route === 'admin' && path[1] === 'about') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminGetAbout(db));
    }

    if (route === 'admin' && path[1] === 'services') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminGetServices(db));
    }

    if (route === 'admin' && path[1] === 'rental-interiors') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminGetRentalInteriors(db));
    }

    if (route === 'admin' && path[1] === 'gallery') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminGetGallery(db));
    }

    if (route === 'admin' && path[1] === 'seo') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminGetSeo(db));
    }

    if (route === 'admin' && path[1] === 'leads') {
      return adminLeads(request);
    }

    if (route === 'admin' && path[1] === 'vendors') {
      return adminVendors(request);
    }

    if (route === 'admin' && path[1] === 'dashboard') {
      return adminDashboard(request);
    }

    if (route === 'admin' && path[1] === 'pricing') {
      return adminPricing(request);
    }

    if (route === 'admin' && path[1] === 'quote' && path[3] === 'pdf') {
      return quotePdf(request, path[2]);
    }

    if (route === 'city' && path[1] === 'mumbai') {
      return json({
        page: {
          slug: 'interior-design-mumbai',
          title: `Interior Design & Solutions in Mumbai | ${BRAND.name}`,
          metaDescription: 'Book professional interior design, modular kitchens, wardrobes and turnkey execution in Mumbai with free consultation and digital quotation.',
          h1: 'Premium Interior Design Services in Mumbai',
          internalLinks: ['Modular Kitchen Mumbai', 'Rental Interiors Mumbai', 'Interior Designer Near Me Mumbai'],
        },
      });
    }

    return json({ error: 'API route not found.' }, 404);
  } catch (error) {
    return json({ error: error.message || 'Unexpected server error.' }, 500);
  }
}

export async function POST(request, context) {
  try {
    const path = getPathSegments(context);
    const route = path[0];

    if (route === 'calculate') {
      const body = await request.json();
      const db = await getDb();
      const pricing = await getPricingSettings(db);
      return json({ estimate: calculateEstimate(body, pricing) });
    }

    if (route === 'leads') {
      return createLead(request);
    }

    if (route === 'vendors') {
      return createVendorRequest(request);
    }

    if (route === 'enquiry-events') {
      return createEnquiryEvent(request);
    }

    if (route === 'auth' && path[1] === 'setup') {
      return setupAdmin(request);
    }

    if (route === 'auth' && path[1] === 'login') {
      return loginAdmin(request);
    }

    if (route === 'auth' && path[1] === 'logout') {
      return logoutAdmin();
    }

    if (route === 'auth' && path[1] === 'reset-password') {
      return resetAdminPassword(request);
    }

    if (route === 'admin' && path[1] === 'pricing' && path[2] === 'reset') {
      return resetAdminPricing(request);
    }

    if (route === 'admin' && path[1] === 'pricing') {
      return saveAdminPricing(request);
    }

    if (route === 'admin' && path[1] === 'shades' && path[2] === 'import') {
      return adminImportShades(request);
    }

    if (route === 'admin' && path[1] === 'email' && path[2] === 'retry') {
      return retryEmailNotificationsAdmin(request);
    }

    if (route === 'admin' && path[1] === 'whatsapp' && path[2] === 'send') {
      return sendWhatsAppQuote(request);
    }

    if (route === 'visualizer' && path[1] === 'transform') {
      return visualizerTransform(request);
    }

    const db = await getDb();

    if (route === 'admin' && path[1] === 'about') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      const result = await adminSaveAbout(db, body);
      return json(result);
    }

    if (route === 'admin' && path[1] === 'services' && path[2] === 'reorder') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      return json(await adminReorderServices(db, body));
    }

    if (route === 'admin' && path[1] === 'services') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      const result = await adminSaveService(db, body);
      if (result.error) return json({ error: result.error }, result.status || 400);
      return json(result);
    }

    if (route === 'admin' && path[1] === 'rental-interiors') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      const result = await adminSaveRentalInteriors(db, body);
      if (result.error) return json({ error: result.error }, result.status || 400);
      return json(result);
    }

    if (route === 'admin' && path[1] === 'gallery' && path[2] === 'reorder') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      return json(await adminReorderGallery(db, body));
    }

    if (route === 'admin' && path[1] === 'gallery' && path[2] === 'categories') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      const result = await adminSaveGalleryCategory(db, body);
      if (result.error) return json({ error: result.error }, result.status || 400);
      return json(result);
    }

    if (route === 'admin' && path[1] === 'gallery') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      const result = await adminSaveGalleryItem(db, body);
      if (result.error) return json({ error: result.error }, result.status || 400);
      return json(result);
    }

    if (route === 'admin' && path[1] === 'seo') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const body = await request.json();
      return json(await adminSaveSeo(db, body));
    }

    if (route === 'admin' && path[1] === 'media' && path[2] === 'upload') {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      const result = await adminUploadMedia(request);
      if (result.error) return json({ error: result.error }, result.status || 400);
      return json(result);
    }

    return json({ error: 'API route not found.' }, 404);
  } catch (error) {
    return json({ error: error.message || 'Unexpected server error.' }, 500);
  }
}

export async function PUT(request, context) {
  try {
    const path = getPathSegments(context);

    if (path[0] === 'leads') {
      return updateLead(request, path[1]);
    }

    if (path[0] === 'admin' && path[1] === 'leads') {
      return updateLeadAdmin(request, path[2]);
    }

    if (path[0] === 'admin' && path[1] === 'vendors') {
      return updateVendorAdmin(request, path[2]);
    }

    return json({ error: 'API route not found.' }, 404);
  } catch (error) {
    return json({ error: error.message || 'Unexpected server error.' }, 500);
  }
}

export async function DELETE(request, context) {
  try {
    const path = getPathSegments(context);
    const db = await getDb();

    if (path[0] === 'admin' && path[1] === 'services' && path[2]) {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminDeleteService(db, path[2]));
    }

    if (path[0] === 'admin' && path[1] === 'gallery' && path[2]) {
      const admin = await requireAdmin(request);
      if (!admin) return json({ error: 'Admin authentication required.' }, 401);
      return json(await adminDeleteGalleryItem(db, path[2]));
    }

    if (path[0] !== 'leads' || !path[1]) {
      return json({ error: 'Resource id is required.' }, 400);
    }

    const result = await db.collection('leads').deleteOne({ id: path[1] });
    return json({ deleted: result.deletedCount === 1 });
  } catch (error) {
    return json({ error: error.message || 'Unexpected server error.' }, 500);
  }
}
