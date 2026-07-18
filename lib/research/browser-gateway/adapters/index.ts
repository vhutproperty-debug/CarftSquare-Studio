import { BrowserbaseAdapter } from '@/lib/research/browser-gateway/adapters/browserbase';
import { BrowserlessAdapter } from '@/lib/research/browser-gateway/adapters/browserless';
import { SelfHostedBrowserAdapter } from '@/lib/research/browser-gateway/adapters/self-hosted';
import type { BrowserProviderAdapter, BrowserProviderKind } from '@/lib/research/browser-gateway/types';

/**
 * Resolve browser provider from env. Default: self_hosted (Docker worker / local Playwright).
 * Swap providers without changing UI or connector orchestration.
 */
export function resolveBrowserProvider(): BrowserProviderKind {
  const raw = (process.env.RESEARCH_BROWSER_PROVIDER || 'self_hosted').toLowerCase();
  if (raw === 'browserless') return 'browserless';
  if (raw === 'browserbase') return 'browserbase';
  if (raw === 'docker' || raw === 'docker_worker') return 'docker_worker';
  return 'self_hosted';
}

export function getBrowserProviderAdapter(
  kind: BrowserProviderKind = resolveBrowserProvider(),
): BrowserProviderAdapter {
  switch (kind) {
    case 'browserless':
      return new BrowserlessAdapter();
    case 'browserbase':
      return new BrowserbaseAdapter();
    case 'docker_worker':
    case 'self_hosted':
    default:
      return new SelfHostedBrowserAdapter();
  }
}
