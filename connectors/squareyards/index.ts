import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import { collectGenericListings } from '@/connectors/common/listing-parser';
import type { LoginConfidenceSignal } from '@/connectors/common/login-confidence';
import { buildPortalSearchUrl } from '@/connectors/common/search-url';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

export class SquareyardsConnector extends BasePortalConnector {
  readonly key = 'squareyards';
  readonly displayName = 'Square Yards';

  getLoginUrl(): string {
    return 'https://www.squareyards.com/user/login';
  }

  protected async portalAuthExtraSignals(page: Page): Promise<LoginConfidenceSignal[]> {
    const body = (await page.content().catch(() => '')).toLowerCase();
    return [
      {
        name: 'squareyards_logout',
        pass: /log\s*out|sign\s*out/.test(body),
        weight: 15,
      },
      {
        name: 'squareyards_dashboard',
        pass: /my\s*dashboard|my\s*account|saved\s*searches/.test(body),
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

export const squareyardsConnector = new SquareyardsConnector();
