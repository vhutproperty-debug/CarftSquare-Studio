import Link from 'next/link';
import { ArrowRight, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { formatBlogDate } from '@/lib/blog/format';
import SeoImage from '@/components/SeoImage';

export default function BlogPostCard({ post, priority = false }) {
  if (!post) return null;

  return (
    <Card className="group overflow-hidden rounded-2xl border border-slate-100 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-orange-100/50">
      <Link href={`/blog/${post.slug}`} className="block">
        {post.featuredImage ? (
          <div className="relative aspect-[16/10] overflow-hidden">
            <SeoImage
              src={post.featuredImage}
              alt={post.title}
              fill
              priority={priority}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : null}
        <CardContent className="p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {post.category ? (
              <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">{post.category}</Badge>
            ) : null}
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTimeMinutes} min read
            </span>
          </div>
          <h3
            className="text-xl font-black leading-tight text-slate-950 transition-colors group-hover:text-orange-600"
            style={{ fontFamily: "'Cormorant Garamond', serif" }}
          >
            {post.title}
          </h3>
          {post.excerpt ? (
            <p className="mt-3 line-clamp-3 text-sm leading-7 text-slate-600">{post.excerpt}</p>
          ) : null}
          <div className="mt-4 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {post.author?.name || 'CraftSquare Studio'}
            </span>
            <span>{formatBlogDate(post.publishedAt)}</span>
          </div>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-orange-600">
            Read article <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </CardContent>
      </Link>
    </Card>
  );
}
