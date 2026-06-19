import { cache } from 'react';
import type { BlogType } from '@/lib/blog/types';
import {
  getDatabase,
  getPublishedPostBySlug,
  listPublishedPosts,
  listRelatedPosts,
  listPublishedSlugs,
} from '@/lib/blog/store';

/** Dedupe blog fetches within a single request (metadata + layout + page). */
export const getCachedPublishedPostBySlug = cache(async (slug: string) => {
  const db = await getDatabase();
  return getPublishedPostBySlug(db, slug);
});

export const getCachedRelatedPosts = cache(async (slug: string, category?: string, blogType: BlogType = 'owner', limit = 3) => {
  const db = await getDatabase();
  return listRelatedPosts(db, { slug, category, blogType, limit });
});

export const getCachedPublishedPosts = cache(async (options: {
  page?: number;
  limit?: number;
  category?: string;
} = {}) => {
  const db = await getDatabase();
  return listPublishedPosts(db, options);
});

export const getCachedPublishedSlugs = cache(async (limit = 500) => {
  const db = await getDatabase();
  return listPublishedSlugs(db, { limit });
});
