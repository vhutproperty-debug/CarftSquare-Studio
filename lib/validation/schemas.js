import { z } from 'zod';

const phoneSchema = z.string().trim().min(8).max(20).regex(/^[+\d\s()-]+$/);
const emailSchema = z.string().trim().email().max(254).optional().or(z.literal(''));

export const leadCreateSchema = z.object({
  website: z.string().optional(),
  companyWebsite: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: emailSchema,
  service: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().max(120).optional(),
  propertyType: z.string().trim().max(40).optional(),
  bhk: z.string().trim().max(20).optional(),
  area: z.union([z.number(), z.string()]).optional(),
  paintQuality: z.string().trim().max(40).optional(),
  projectType: z.string().trim().max(40).optional(),
  preferredSlot: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).optional(),
  estimate: z.record(z.any()).optional(),
});

export const vendorCreateSchema = z.object({
  website: z.string().optional(),
  companyWebsite: z.string().optional(),
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  cityArea: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  servicesOffered: z.union([z.array(z.string()), z.string()]).optional(),
  yearsExperience: z.union([z.number(), z.string()]).optional(),
  teamSize: z.union([z.number(), z.string()]).optional(),
  gstPan: z.string().trim().max(40).optional(),
  portfolioNotes: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).optional(),
});

export const enquiryEventSchema = z.object({
  type: z.string().trim().max(80).optional(),
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(20).optional(),
  email: emailSchema,
  service: z.string().trim().max(120).optional(),
  label: z.string().trim().max(120).optional(),
  message: z.string().trim().max(2000).optional(),
  source: z.string().trim().max(80).optional(),
});

export const authLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
});

export const authSetupSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120).optional(),
});

export const authResetPasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

export const updateLeadSchema = z.object({
  status: z.enum(['new', 'scheduled', 'quoted', 'in_progress', 'completed']).optional(),
  assignedVendor: z.string().trim().max(120).optional(),
  paymentStatus: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(2000).optional(),
  preferredSlot: z.string().trim().max(80).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

export const updateVendorSchema = z.object({
  status: z.enum(['new', 'contacted', 'approved', 'rejected']).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

export function parseRequestBody(schema, body) {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues.map((issue) => issue.message).join('; ');
    return { error: message || 'Invalid request payload.' };
  }
  return { data: result.data };
}
