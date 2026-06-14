import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import BlogSiteNav from '@/components/blog/BlogSiteNav';
import BlogPostCard from '@/components/blog/BlogPostCard';
import BlogPagination from '@/components/blog/BlogPagination';
import SectionHeader from '@/components/SectionHeader';
import { Badge } from '@/components/ui/badge';
import { getCachedPublishedPosts } from '@/lib/blog/cached-queries';

export const revalidate = 3600;

function parsePage(value) {
  const page = Number(value) || 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default async function BlogPage({ searchParams }) {
  const page = parsePage(searchParams?.page);
  const category = String(searchParams?.category || '').trim();

  let data = { posts: [], total: 0, page: 1, limit: 12, totalPages: 1, categories: [] };
  try {
    data = await getCachedPublishedPosts({ page, limit: 12, category });
  } catch {
    // Render empty state when DB is unavailable in local dev.
  }

  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <BlogSiteNav />

      <section className="bg-slate-950 py-24 text-white">
        <div className="container">
          <SectionHeader
            light
            eyebrow="Insights & Inspiration"
            title="Interior design blog"
            text="Practical guides on modular kitchens, rental interiors, wardrobes and Mumbai home design from our studio team."
          />
        </div>
      </section>

      <section className="py-24">
        <div className="container">
          {data.categories.length > 0 ? (
            <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
              <Link href="/blog">
                <Badge className={!category ? 'bg-orange-600 text-white hover:bg-orange-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}>
                  All
                </Badge>
              </Link>
              {data.categories.map((item) => (
                <Link key={item} href={item === category ? '/blog' : `/blog?category=${encodeURIComponent(item)}`}>
                  <Badge className={item === category ? 'bg-orange-600 text-white hover:bg-orange-600' : 'bg-slate-100 text-slate-700 hover:bg-slate-100'}>
                    {item}
                  </Badge>
                </Link>
              ))}
            </div>
          ) : null}

          {data.posts.length > 0 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {data.posts.map((post, index) => (
                  <BlogPostCard key={post.slug} post={post} priority={index < 3} />
                ))}
              </div>
              <BlogPagination page={data.page} totalPages={data.totalPages} category={category} />
            </>
          ) : (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 px-6 py-16 text-center">
              <p className="text-lg font-bold text-slate-700">No articles published yet.</p>
              <p className="mt-2 text-sm text-slate-500">Check back soon for interior design insights from {BRAND.name}.</p>
              <Link href="/" className="mt-6 inline-block font-bold text-orange-600">Back to homepage</Link>
            </div>
          )}
        </div>
      </section>

      <footer className="bg-slate-50 py-8 text-center text-sm text-slate-500">
        <p>© 2025 {BRAND.name}</p>
        <Link href="/" className="mt-2 inline-block font-bold text-orange-600">Back to homepage</Link>
      </footer>
    </main>
  );
}
