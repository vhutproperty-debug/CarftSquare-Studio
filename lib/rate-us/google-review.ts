/**
 * Google Review destination — replace the placeholder when your Business Profile link is ready.
 */
export const GOOGLE_REVIEW_URL = 'YOUR_GOOGLE_REVIEW_LINK_HERE';

export function openGoogleReviewPage(): void {
  if (typeof window === 'undefined') return;
  window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer');
}

/** Future Review Assistant: user feedback captured before AI draft generation. */
export interface ReviewAssistantFeedback {
  projectType?: string;
  highlights?: string;
  rating?: number;
}

/** Future Review Assistant: polished draft the customer can copy to Google. */
export interface ReviewAssistantDraft {
  draftText: string;
  generatedAt: string;
}
