import { slugify, normalizeSeoBlock } from '@/lib/cms/normalize';
import { estimateReadingTimeMinutes } from '@/lib/blog/reading-time';

const BLOG_TYPES = new Set(['owner', 'partner']);

export function normalizeBlogType(value) {
  const type = String(value || 'owner').trim().toLowerCase();
  return BLOG_TYPES.has(type) ? type : 'owner';
}

export function normalizeBlogAuthor(input = {}) {
  return {
    name: String(input.name || 'CraftSquare Studio').trim(),
    role: String(input.role || '').trim(),
    avatar: String(input.avatar || '').trim(),
  };
}

export function normalizeBlogPost(input = {}) {
  const title = String(input.title || '').trim();
  const slug = slugify(input.slug || title);
  if (!title || !slug) return null;

  const content = String(input.content || '').trim();
  const contentFormat = input.contentFormat === 'text' ? 'text' : 'html';
  const status = ['draft', 'published', 'archived'].includes(input.status) ? input.status : 'draft';
  const publishedAt = String(input.publishedAt || input.createdAt || new Date().toISOString()).trim();
  const updatedAt = String(input.updatedAt || publishedAt).trim();

  return {
    id: String(input.id || slug).trim(),
    slug,
    title,
    excerpt: String(input.excerpt || '').trim(),
    content,
    contentFormat,
    category: String(input.category || 'Interior Design').trim(),
    blogType: normalizeBlogType(input.blogType),
    featuredImage: String(input.featuredImage || input.coverImage || '').trim(),
    author: normalizeBlogAuthor(input.author),
    publishedAt,
    updatedAt,
    readingTimeMinutes: Number(input.readingTimeMinutes) || estimateReadingTimeMinutes(content),
    status,
    tags: Array.isArray(input.tags) ? input.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    seo: normalizeSeoBlock(input.seo),
  };
}

export function publicBlogCard(post) {
  if (!post) return null;
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    featuredImage: post.featuredImage,
    author: post.author,
    publishedAt: post.publishedAt,
    readingTimeMinutes: post.readingTimeMinutes,
  };
}

export function publicBlogPost(post) {
  if (!post) return null;
  return {
    ...publicBlogCard(post),
    content: post.content,
    contentFormat: post.contentFormat,
    blogType: normalizeBlogType(post.blogType),
    tags: post.tags,
    updatedAt: post.updatedAt,
    seo: post.seo,
  };
}
