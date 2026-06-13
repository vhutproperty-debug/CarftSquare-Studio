export type BlogPostStatus = 'draft' | 'published' | 'archived';

export type BlogAuthor = {
  name: string;
  role?: string;
  avatar?: string;
};

export type BlogSeo = {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImage: string;
  canonicalUrl: string;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  contentFormat: 'html' | 'text';
  category: string;
  featuredImage: string;
  author: BlogAuthor;
  publishedAt: string;
  updatedAt: string;
  readingTimeMinutes: number;
  status: BlogPostStatus;
  tags: string[];
  seo: BlogSeo;
};

export type BlogPostCard = Pick<
  BlogPost,
  | 'slug'
  | 'title'
  | 'excerpt'
  | 'category'
  | 'featuredImage'
  | 'author'
  | 'publishedAt'
  | 'readingTimeMinutes'
>;

export type BlogListResult = {
  posts: BlogPostCard[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  categories: string[];
};
