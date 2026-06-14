import Link from 'next/link';
import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock, User } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import BlogSiteNav from '@/components/blog/BlogSiteNav';
import BlogRichContent from '@/components/blog/BlogRichContent';
import RelatedPosts from '@/components/blog/RelatedPosts';
import { Badge } from '@/components/ui/badge';
import { formatBlogDate } from '@/lib/blog/format';
import { getCachedPublishedPostBySlug, getCachedRelatedPosts, getCachedPublishedSlugs } from '@/lib/blog/cached-queries';
import SeoImage from '@/components/SeoImage';
import BlogViewTracker from '@/components/BlogViewTracker';

const BlogArticleCta = dynamic(() => import('@/components/blog/BlogArticleCta'), { ssr: true });

export const revalidate = 3600;

export async function generateStaticParams() {
  try {
    const slugs = await getCachedPublishedSlugs(500);
    return slugs.map(({ slug }) => ({ slug }));
  } catch {
    return [];
  }
}

export default async function BlogPostPage({ params }) {
  let post = null;
  let relatedPosts = [];

  try {
    post = await getCachedPublishedPostBySlug(params.slug);
    if (post) {
      relatedPosts = await getCachedRelatedPosts(post.slug, post.category, 3);
    }
  } catch {
    post = null;
  }

  if (!post) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <BlogViewTracker slug={post.slug} title={post.title} category={post.category} />
      <BlogSiteNav />

      <section className="bg-slate-950 py-16 text-white md:py-24">
        <div className="container max-w-4xl">
          <Link href="/blog" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Back to blog
          </Link>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {post.category ? (
              <Badge className="bg-orange-500 text-white hover:bg-orange-500">{post.category}</Badge>
            ) : null}
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-300">
              <Clock className="h-4 w-4" />
              {post.readingTimeMinutes} min read
            </span>
          </div>
          <h1
            className="text-4xl font-black leading-tight md:text-6xl"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="mt-6 text-lg leading-8 text-slate-300">{post.excerpt}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm font-semibold text-slate-300">
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4" />
              {post.author?.name || BRAND.name}
              {post.author?.role ? <span className="font-normal text-slate-400">· {post.author.role}</span> : null}
            </span>
            <span>{formatBlogDate(post.publishedAt)}</span>
          </div>
        </div>
      </section>

      {post.featuredImage ? (
        <section className="container max-w-5xl -mt-10 md:-mt-14">
          <div className="relative h-64 overflow-hidden rounded-3xl shadow-2xl md:h-[28rem]">
            <SeoImage
              src={post.featuredImage}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
        </section>
      ) : null}

      <section className="py-16 md:py-24">
        <div className="container max-w-3xl">
          <BlogRichContent content={post.content} contentFormat={post.contentFormat} />
          {post.tags?.length > 0 ? (
            <div className="mt-10 flex flex-wrap gap-2 border-t border-slate-100 pt-8">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-slate-200 text-slate-600">
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <BlogArticleCta slug={post.slug} />

      <RelatedPosts posts={relatedPosts} />

      <footer className="bg-white py-8 text-center text-sm text-slate-500">
        <p>© 2025 {BRAND.name}</p>
        <Link href="/blog" className="mt-2 inline-block font-bold text-orange-600">More articles</Link>
      </footer>
    </main>
  );
}
