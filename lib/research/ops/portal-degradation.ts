/**
 * Graceful degradation when a portal DOM/layout changes.
 * Empty extracts must NOT invalidate auth sessions.
 */

export type PortalDegradation = {
  portal: string;
  at: string;
  reason: string;
  consecutiveEmpty: number;
};

const degraded = new Map<string, PortalDegradation>();

export function markPortalDegraded(portal: string, reason: string): PortalDegradation {
  const prev = degraded.get(portal);
  const entry: PortalDegradation = {
    portal,
    at: new Date().toISOString(),
    reason,
    consecutiveEmpty: (prev?.consecutiveEmpty || 0) + 1,
  };
  degraded.set(portal, entry);
  return entry;
}

export function clearPortalDegraded(portal: string): void {
  degraded.delete(portal);
}

export function isPortalDegraded(portal: string): boolean {
  return degraded.has(portal);
}

export function getPortalDegradation(portal: string): PortalDegradation | null {
  return degraded.get(portal) || null;
}

export function listPortalDegradations(): PortalDegradation[] {
  return [...degraded.values()];
}

/**
 * Classify whether zero listings should degrade extractors only (keep session valid).
 */
export function shouldDegradeOnEmptyExtract(input: {
  pageUrl?: string;
  title?: string;
  bodySnippet?: string;
}): { degrade: boolean; reason: string } {
  const hay = `${input.pageUrl || ''} ${input.title || ''} ${input.bodySnippet || ''}`.toLowerCase();
  // Still authenticated challenge / login → not DOM-change degradation
  if (/sign.?in|log.?in|otp|verify.?mobile|authentication|please login/i.test(hay)) {
    return { degrade: false, reason: 'Page looks like login — treat as auth issue' };
  }
  if (/security|challenge|captcha|access denied|akamai|bot.?detect/i.test(hay)) {
    return {
      degrade: true,
      reason: 'Portal security/challenge page — session may still be valid; extractors degraded',
    };
  }
  return {
    degrade: true,
    reason: 'Authenticated search returned 0 listings — portal DOM/selectors may have changed',
  };
}
