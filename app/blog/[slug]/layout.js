import { notFound } from 'next/navigation';
import { buildBlogPostMetadata } from '@/lib/seo/metadata';
import { buildArticleJsonLd } from '@/lib/seo/jsonld';
import { blogPostBreadcrumb } from '@/lib/seo/breadcrumbs';
import JsonLd from '@/components/JsonLd';
import { getCachedPublishedPostBySlug } from '@/lib/blog/cached-queries';

export const revalidate = 3600;

export async function generateMetadata({ params }) {
  const slug = params.slug;

  try {
    const post = await getCachedPublishedPostBySlug(slug);
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
    post = await getCachedPublishedPostBySlug(params.slug);
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
