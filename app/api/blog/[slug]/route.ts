import { getDatabase, getPublishedPostBySlug, listRelatedPosts } from '@/lib/blog/store';
import { jsonWithCache } from '@/lib/blog/api-cache';

export const revalidate = 3600;

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const db = await getDatabase();
    const post = await getPublishedPostBySlug(db, params.slug);

    if (!post) {
      return jsonWithCache({ error: 'Post not found' }, { status: 404 });
    }

    const relatedPosts = await listRelatedPosts(db, {
      slug: post.slug,
      category: post.category,
      limit: 3,
    });

    return jsonWithCache({ post, relatedPosts });
  } catch (error) {
    return jsonWithCache(
      { error: error instanceof Error ? error.message : 'Failed to load blog post' },
      { status: 500 },
    );
  }
}
