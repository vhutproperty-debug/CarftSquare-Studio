import { z } from 'zod';

export const paintingLeadSubmitSchema = z.object({
  name: z.string().trim().min(2).max(120),
  mobile: z.string().trim().min(10).max(20),
  location: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200).optional().or(z.literal('')),
  propertyType: z.string().trim().max(80).optional(),
  apartmentSize: z.string().trim().max(80).optional(),
  requirement: z.string().trim().max(500).optional(),
  visitDate: z.string().trim().max(80).optional(),
  budget: z.string().trim().max(80).optional(),
  message: z.string().trim().max(2000).optional(),
});

export const paintingLeadUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['new', 'contacted', 'site_visit_scheduled', 'quoted', 'won', 'lost']).optional(),
  notes: z.string().max(5000).optional(),
});

export const paintingLeadDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const paintingGalleryItemSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  imageUrl: z.string().trim().url().max(500),
  category: z.string().trim().max(80).optional().default(''),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  active: z.boolean().optional().default(true),
});

export const paintingGalleryDeleteSchema = z.object({
  id: z.string().uuid(),
});

export const paintingTestimonialSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  location: z.string().trim().max(120).optional().default(''),
  rating: z.number().int().min(1).max(5).optional().default(5),
  text: z.string().trim().min(10).max(2000),
  projectType: z.string().trim().max(120).optional().default(''),
  sortOrder: z.number().int().min(0).max(9999).optional().default(0),
  active: z.boolean().optional().default(true),
});

export const paintingTestimonialDeleteSchema = z.object({
  id: z.string().uuid(),
});
