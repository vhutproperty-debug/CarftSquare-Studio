import { z } from 'zod';

export const reviewCreateSchema = z.object({
  customerName: z.string().trim().min(2).max(120),
  projectType: z.string().trim().min(2).max(80),
  rating: z.number().int().min(1).max(5),
  reviewText: z.string().trim().min(10).max(2000),
  images: z.array(z.string().url().max(500)).max(6).optional().default([]),
  area: z.string().trim().max(80).optional().default(''),
});

export const reviewPublicSubmitSchema = reviewCreateSchema;

export const reviewUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  customerName: z.string().trim().min(2).max(120).optional(),
  projectType: z.string().trim().min(2).max(80).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  reviewText: z.string().trim().min(10).max(2000).optional(),
  images: z.array(z.string().url().max(500)).max(6).optional(),
  area: z.string().trim().max(80).optional(),
});

export const reviewDeleteSchema = z.object({
  id: z.string().uuid(),
});
