import { notFound } from 'next/navigation';
import { buildBlogPostMetadata } from '@/lib/seo/metadata';
import { buildArticleJsonLd } from '@/lib/seo/jsonld';
import { blogPostBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';
import { getDatabase, getPublishedPostBySlug } from '@/lib/blog/store';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const slug = params.slug;

  try {
    const db = await getDatabase();
    const post = await getPublishedPostBySlug(db, slug);
    if (!post) {
      return {
        title: { absolute: 'Article Not Found' },
        robots: { index: false, follow: false },
      };
    }
    return buildBlogPostMetadata(post, slug);
  } catch {
    return {
      title: { absolute: 'Article Not Found' },
      robots: { index: false, follow: false },
    };
  }
}

export default async function BlogPostLayout({ children, params }) {
  let post = null;

  try {
    const db = await getDatabase();
    post = await getPublishedPostBySlug(db, params.slug);
  } catch {
    post = null;
  }

  if (!post) {
    notFound();
  }

  const articleSchema = buildArticleJsonLd(post, params.slug);
  const breadcrumbSchema = blogPostBreadcrumb(post.title, params.slug);

  return (
    <>
      <JsonLd data={articleSchema} />
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
