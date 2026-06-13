import { NextResponse } from 'next/server';
import { getDatabase, getPublishedPostBySlug, listRelatedPosts } from '@/lib/blog/store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const db = await getDatabase();
    const post = await getPublishedPostBySlug(db, params.slug);

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const relatedPosts = await listRelatedPosts(db, {
      slug: post.slug,
      category: post.category,
      limit: 3,
    });

    return NextResponse.json({ post, relatedPosts });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load blog post' },
      { status: 500 },
    );
  }
}
