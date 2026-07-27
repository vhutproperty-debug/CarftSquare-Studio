import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import { collectGenericListings } from '@/connectors/common/listing-parser';
import type { LoginConfidenceSignal } from '@/connectors/common/login-confidence';
import { buildPortalSearchUrl } from '@/connectors/common/search-url';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

export class NobrokerConnector extends BasePortalConnector {
  readonly key = 'nobroker';
  readonly displayName = 'NoBroker';

  getLoginUrl(): string {
    return 'https://www.nobroker.in/users/login';
  }

  getVerifyUrl(): string {
    return 'https://www.nobroker.in/';
  }

  protected async portalAuthExtraSignals(page: Page): Promise<LoginConfidenceSignal[]> {
    const body = (await page.content().catch(() => '')).toLowerCase();
    return [
      {
        name: 'nobroker_logout',
        pass: /log\s*out|sign\s*out/.test(body),
        weight: 15,
      },
      {
        name: 'nobroker_profile',
        pass: /my\s*profile|my\s*shortlists|owner\s*dashboard/.test(body),
        weight: 10,
      },
    ];
  }

  protected buildSearchUrl(criteria: ConnectorSearchRequest['criteria']): string {
    return buildPortalSearchUrl(this.key, criteria);
  }

  protected async parseListingsFromPage(page: Page, portal: string): Promise<ResearchListing[]> {
    return collectGenericListings(page, portal);
  }
}

export const nobrokerConnector = new NobrokerConnector();
