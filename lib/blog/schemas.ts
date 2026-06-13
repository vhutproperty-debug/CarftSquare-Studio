import { z } from 'zod';

const blogSeoSchema = z.object({
  metaTitle: z.string().max(200).optional(),
  metaDescription: z.string().max(320).optional(),
  keywords: z.array(z.string().max(80)).optional(),
  ogImage: z.string().max(2000).optional(),
  canonicalUrl: z.string().max(2000).optional(),
}).optional();

const blogAuthorSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  role: z.string().max(120).optional(),
  avatar: z.string().max(2000).optional(),
}).optional();

export const blogStatusSchema = z.enum(['draft', 'published', 'archived']);

export const blogCreateSchema = z.object({
  title: z.string().min(1).max(240),
  slug: z.string().max(240).optional(),
  excerpt: z.string().max(600).optional(),
  content: z.string().max(200000).optional(),
  contentFormat: z.enum(['html', 'text']).optional(),
  category: z.string().max(120).optional(),
  tags: z.array(z.string().max(80)).optional(),
  status: blogStatusSchema.optional(),
  featuredImage: z.string().max(2000).optional(),
  author: blogAuthorSchema,
  seo: blogSeoSchema,
});

export const blogUpdateSchema = blogCreateSchema.extend({
  id: z.string().min(1),
});

export const blogDeleteSchema = z.object({
  id: z.string().min(1),
});
