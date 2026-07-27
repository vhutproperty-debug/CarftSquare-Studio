import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import { collectGenericListings } from '@/connectors/common/listing-parser';
import type { LoginConfidenceSignal } from '@/connectors/common/login-confidence';
import { buildPortalSearchUrl } from '@/connectors/common/search-url';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

export class NinetyNineAcresConnector extends BasePortalConnector {
  readonly key = '99acres';
  readonly displayName = '99acres';

  getLoginUrl(): string {
    return 'https://www.99acres.com/';
  }

  getVerifyUrl(): string {
    return 'https://www.99acres.com/';
  }

  protected async portalAuthExtraSignals(page: Page): Promise<LoginConfidenceSignal[]> {
    const body = (await page.content().catch(() => '')).toLowerCase();
    return [
      {
        name: '99acres_logout',
        pass: /log\s*out|sign\s*out/.test(body),
        weight: 15,
      },
      {
        name: '99acres_my99acres',
        pass: /my99acres|my\s*99acres|owner\s*dashboard/.test(body),
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

export const ninetyNineAcresConnector = new NinetyNineAcresConnector();
