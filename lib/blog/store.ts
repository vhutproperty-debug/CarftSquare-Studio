import { v4 as uuidv4 } from 'uuid';
import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { DEFAULT_BLOG_POSTS } from '@/lib/blog/defaults';
import { normalizeBlogPost, publicBlogCard, publicBlogPost } from '@/lib/blog/normalize';
import type { BlogListResult, BlogPost, BlogPostCard, BlogType } from '@/lib/blog/types';
import { revalidatePublishedBlogRoutes } from '@/lib/seo/revalidate';

const COLLECTION = 'blog_posts';
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;
const MAX_PAGE = 500;

let blogBootstrapPromise: Promise<void> | null = null;

async function bootstrapBlogOnce(db: Db): Promise<void> {
  if (!blogBootstrapPromise) {
    blogBootstrapPromise = seedBlogDefaults(db);
  }
  await blogBootstrapPromise;
}

const LIST_PROJECTION = {
  _id: 0,
  slug: 1,
  title: 1,
  excerpt: 1,
  category: 1,
  featuredImage: 1,
  author: 1,
  publishedAt: 1,
  readingTimeMinutes: 1,
};

export async function getDatabase(): Promise<Db> {
  return getDb();
}

export async function ensureBlogIndexes(db: Db): Promise<void> {
  await db.collection(COLLECTION).createIndex({ id: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ slug: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ status: 1, publishedAt: -1 });
  await db.collection(COLLECTION).createIndex({ status: 1, category: 1, publishedAt: -1 });
  await db.collection(COLLECTION).createIndex({ status: 1, tags: 1, publishedAt: -1 });
}

export async function seedBlogDefaults(db: Db): Promise<void> {
  const count = await db.collection(COLLECTION).countDocuments();
  if (count > 0) return;

  const now = new Date().toISOString();
  const docs = DEFAULT_BLOG_POSTS.map((post) => {
    const normalized = normalizeBlogPost({ ...post, updatedAt: now });
    return normalized;
  }).filter(Boolean);

  if (docs.length) {
    await db.collection(COLLECTION).insertMany(docs);
    revalidatePublishedBlogRoutes();
  }
}

function publishedQuery(category?: string) {
  const query: Record<string, unknown> = { status: 'published' };
  if (category?.trim()) query.category = category.trim();
  return query;
}

function clampLimit(limit?: number) {
  const value = Number(limit) || DEFAULT_LIMIT;
  return Math.min(MAX_LIMIT, Math.max(1, value));
}

function clampPage(page?: number) {
  const value = Number(page) || 1;
  return Math.min(MAX_PAGE, Math.max(1, value));
}

export async function listPublishedCategories(db: Db): Promise<string[]> {
  const categories = await db.collection(COLLECTION).distinct('category', { status: 'published' });
  return categories.map(String).filter(Boolean).sort();
}

export async function listPublishedPosts(
  db: Db,
  options: { page?: number; limit?: number; category?: string } = {},
): Promise<BlogListResult> {
  await bootstrapBlogOnce(db);

  const limit = clampLimit(options.limit);
  const page = clampPage(options.page);
  const query = publishedQuery(options.category);

  const [total, posts, categories] = await Promise.all([
    db.collection(COLLECTION).countDocuments(query),
    db.collection(COLLECTION)
      .find(query, { projection: LIST_PROJECTION })
      .sort({ publishedAt: -1, slug: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    listPublishedCategories(db),
  ]);

  return {
    posts: posts.map((post) => publicBlogCard(post) as BlogPostCard),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    categories,
  };
}

export async function getPublishedPostBySlug(db: Db, slug: string) {
  const post = await db.collection(COLLECTION).findOne(
    { slug, status: 'published' },
    { projection: { _id: 0 } },
  );
  return publicBlogPost(post);
}

export async function listRelatedPosts(
  db: Db,
  options: { slug: string; category?: string; blogType?: BlogType; limit?: number } ,
): Promise<BlogPostCard[]> {
  const limit = Math.min(6, Math.max(1, Number(options.limit) || 3));
  const query: Record<string, unknown> = {
    status: 'published',
    slug: { $ne: options.slug },
  };
  if (options.category?.trim()) query.category = options.category.trim();

  const blogType = options.blogType || 'owner';
  if (blogType === 'partner') {
    query.blogType = 'partner';
  } else {
    query.$or = [{ blogType: 'owner' }, { blogType: { $exists: false } }];
  }

  const posts = await db.collection(COLLECTION)
    .find(query, { projection: LIST_PROJECTION })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .toArray();

  return posts.map((post) => publicBlogCard(post) as BlogPostCard);
}

export async function listPublishedSlugs(
  db: Db,
  options: { limit?: number; skip?: number } = {},
): Promise<Array<{ slug: string; updatedAt: string }>> {
  const limit = Math.min(50000, Math.max(1, Number(options.limit) || 50000));
  const skip = Math.max(0, Number(options.skip) || 0);

  const rows = await db.collection(COLLECTION)
    .find({ status: 'published' }, { projection: { _id: 0, slug: 1, updatedAt: 1, publishedAt: 1 } })
    .sort({ publishedAt: -1 })
    .skip(skip)
    .limit(limit)
    .toArray();

  return rows.map((row) => ({
    slug: String(row.slug),
    updatedAt: String(row.updatedAt || row.publishedAt || new Date().toISOString()),
  }));
}

export type AdminBlogListOptions = {
  page?: number;
  limit?: number;
  q?: string;
  status?: BlogPost['status'] | 'all';
  category?: string;
};

export type AdminBlogListResult = {
  posts: BlogPost[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: string[];
};

function buildAdminSearchQuery(options: AdminBlogListOptions) {
  const query: Record<string, unknown> = {};
  if (options.status && options.status !== 'all') {
    query.status = options.status;
  }
  if (options.category?.trim()) {
    query.category = options.category.trim();
  }
  const q = String(options.q || '').trim();
  if (q) {
    query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { excerpt: { $regex: q, $options: 'i' } },
      { slug: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
      { tags: { $regex: q, $options: 'i' } },
    ];
  }
  return query;
}

export async function listAdminCategories(db: Db): Promise<string[]> {
  await ensureBlogIndexes(db);
  const categories = await db.collection(COLLECTION).distinct('category');
  return categories.map(String).filter(Boolean).sort();
}

export async function listAdminBlogPosts(
  db: Db,
  options: AdminBlogListOptions = {},
): Promise<AdminBlogListResult> {
  await ensureBlogIndexes(db);

  const limit = clampLimit(options.limit);
  const page = clampPage(options.page);
  const query = buildAdminSearchQuery(options);

  const [total, posts, categories] = await Promise.all([
    db.collection(COLLECTION).countDocuments(query),
    db.collection(COLLECTION)
      .find(query, { projection: { _id: 0 } })
      .sort({ updatedAt: -1, publishedAt: -1, title: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    listAdminCategories(db),
  ]);

  return {
    posts: posts as BlogPost[],
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    categories,
  };
}

export async function getBlogPostById(db: Db, id: string): Promise<BlogPost | null> {
  await ensureBlogIndexes(db);
  const post = await db.collection(COLLECTION).findOne({ id }, { projection: { _id: 0 } });
  return post as BlogPost | null;
}

export async function isBlogSlugTaken(db: Db, slug: string, excludeId?: string): Promise<boolean> {
  const query: Record<string, unknown> = { slug };
  if (excludeId) query.id = { $ne: excludeId };
  const count = await db.collection(COLLECTION).countDocuments(query);
  return count > 0;
}

export async function saveBlogPost(db: Db, input: Partial<BlogPost>) {
  await ensureBlogIndexes(db);
  const normalized = normalizeBlogPost({ ...input, id: input.id || uuidv4(), updatedAt: new Date().toISOString() });
  if (!normalized) return null;

  if (await isBlogSlugTaken(db, normalized.slug, normalized.id)) {
    throw new Error('A blog post with this slug already exists.');
  }

  await db.collection(COLLECTION).updateOne(
    { id: normalized.id },
    { $set: normalized },
    { upsert: true },
  );

  revalidatePublishedBlogRoutes(normalized.status === 'published' ? normalized.slug : undefined);

  return normalized;
}

export async function deleteBlogPost(db: Db, id: string): Promise<boolean> {
  const existing = await getBlogPostById(db, id);
  const result = await db.collection(COLLECTION).deleteOne({ id });
  if (result.deletedCount > 0) {
    revalidatePublishedBlogRoutes(existing?.slug);
    return true;
  }
  return false;
}

export async function getBlogPostBySlug(db: Db, slug: string): Promise<BlogPost | null> {
  await ensureBlogIndexes(db);
  const post = await db.collection(COLLECTION).findOne({ slug }, { projection: { _id: 0 } });
  return post as BlogPost | null;
}
