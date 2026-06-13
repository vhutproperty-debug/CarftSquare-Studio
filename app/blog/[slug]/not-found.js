import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import BlogSiteNav from '@/components/blog/BlogSiteNav';

export default function BlogNotFound() {
  return (
    <main className="min-h-screen bg-white text-slate-950" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <BlogSiteNav />
      <div className="container py-24 text-center">
        <h1 className="text-4xl font-black text-slate-950" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Article not found
        </h1>
        <p className="mt-4 text-slate-600">This blog post may have been moved or is no longer available.</p>
        <Link href="/blog" className="mt-8 inline-block font-bold text-orange-600">Back to blog</Link>
      </div>
    </main>
  );
}
