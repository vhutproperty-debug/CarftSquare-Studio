'use client';

import { useEffect, useRef } from 'react';
import { GA_EVENTS, trackGaEvent } from '@/lib/analytics/ga4';

export default function BlogViewTracker({ slug, title = '', category = '' }) {
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!slug || trackedRef.current) return;
    trackedRef.current = true;
    trackGaEvent(GA_EVENTS.BLOG_VIEWED, {
      blog_slug: slug,
      blog_title: title,
      blog_category: category,
      page_path: `/blog/${slug}`,
    });
  }, [slug, title, category]);

  return null;
}
