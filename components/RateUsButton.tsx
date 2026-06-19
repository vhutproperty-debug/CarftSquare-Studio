'use client';

import { usePathname } from 'next/navigation';
import { GOOGLE_REVIEW_URL, openGoogleReviewPage } from '@/lib/rate-us/google-review';

/**
 * Floating "Rate Us" action. Opens Google Reviews in a new tab.
 * Future: swap handleRateUsClick for an AI Review Assistant modal
 * (collect feedback → generate draft → copy → open Google).
 */
export default function RateUsButton() {
  const pathname = usePathname() || '/';

  if (pathname.startsWith('/admin')) return null;
  if (pathname.startsWith('/free-interior-consultation')) return null;

  function handleRateUsClick() {
    // Future: open ReviewAssistantModal({ onComplete: openGoogleReviewPage })
    openGoogleReviewPage();
  }

  return (
    <button
      type="button"
      onClick={handleRateUsClick}
      className="rate-us-fab"
      aria-label="Rate CraftSquare Studio on Google"
      data-review-url={GOOGLE_REVIEW_URL}
    >
      <span className="rate-us-fab__icon" aria-hidden="true">
        ⭐
      </span>
      <span className="rate-us-fab__label">Rate Us</span>
    </button>
  );
}
