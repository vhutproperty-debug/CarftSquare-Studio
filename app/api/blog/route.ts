import { getDatabase, listPublishedPosts } from '@/lib/blog/store';
import { jsonWithCache } from '@/lib/blog/api-cache';

export const revalidate = 3600;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get('page') || '1');
    const limit = Number(searchParams.get('limit') || '12');
    const category = searchParams.get('category') || undefined;

    const db = await getDatabase();
    const result = await listPublishedPosts(db, { page, limit, category });

    return jsonWithCache(result);
  } catch (error) {
    return jsonWithCache(
      { error: error instanceof Error ? error.message : 'Failed to load blog posts' },
      { status: 500 },
    );
  }
}
