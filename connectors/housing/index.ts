import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import {
  buildHousingSearchEntryUrl,
  collectHousingListings,
} from '@/connectors/housing/housing-listings';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

export class HousingConnector extends BasePortalConnector {
  readonly key = 'housing';
  readonly displayName = 'Housing.com';

  /** Stashed for Housing-specific SERP resolution + field filtering (BHK/project). */
  private lastCriteria?: ConnectorSearchRequest['criteria'];

  async executeSearch(request: ConnectorSearchRequest) {
    this.lastCriteria = request.criteria;
    return super.executeSearch(request);
  }

  protected buildSearchUrl(criteria: ConnectorSearchRequest['criteria']): string {
    return buildHousingSearchEntryUrl(criteria);
  }

  protected async parseListingsFromPage(page: Page, portal: string): Promise<ResearchListing[]> {
    const { listings, stats } = await collectHousingListings(
      page,
      portal,
      this.lastCriteria,
    );
    // Structured extract stats for worker logs / offline validation.
    console.info(
      JSON.stringify({
        scope: 'research-connector',
        portal: 'housing',
        step: 'housing_extract_stats',
        at: new Date().toISOString(),
        ...stats,
      }),
    );
    return listings;
  }
}

export const housingConnector = new HousingConnector();
