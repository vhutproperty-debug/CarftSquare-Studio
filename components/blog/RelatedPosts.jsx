import SectionHeader from '@/components/SectionHeader';
import BlogPostCard from '@/components/blog/BlogPostCard';

export default function RelatedPosts({ posts = [] }) {
  if (!posts.length) return null;

  return (
    <section className="bg-slate-50 py-24">
      <div className="container">
        <SectionHeader
          eyebrow="Keep Reading"
          title="Related articles"
          text="More interior design insights from CraftSquare Studio."
        />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      </div>
    </section>
  );
}
