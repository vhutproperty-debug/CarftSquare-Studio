import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import { collectGenericListings } from '@/connectors/common/listing-parser';
import { buildPortalSearchUrl } from '@/connectors/common/search-url';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

export class HousingConnector extends BasePortalConnector {
  readonly key = 'housing';
  readonly displayName = 'Housing.com';

  protected buildSearchUrl(criteria: ConnectorSearchRequest['criteria']): string {
    return buildPortalSearchUrl(this.key, criteria);
  }

  protected async parseListingsFromPage(page: Page, portal: string): Promise<ResearchListing[]> {
    return collectGenericListings(page, portal);
  }
}

export const housingConnector = new HousingConnector();
