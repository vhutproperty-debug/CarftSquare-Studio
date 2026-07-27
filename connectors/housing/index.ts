import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import type { LoginConfidenceSignal } from '@/connectors/common/login-confidence';
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

  getLoginUrl(): string {
    return 'https://housing.com/user-profile';
  }

  getVerifyUrl(): string {
    return 'https://housing.com/user-profile';
  }

  protected async portalAuthExtraSignals(page: Page): Promise<LoginConfidenceSignal[]> {
    const body = (await page.content().catch(() => '')).toLowerCase();
    return [
      {
        name: 'housing_edit_profile',
        pass: /edit\s*profile/.test(body),
        weight: 15,
      },
      {
        name: 'housing_user_profile_path',
        pass: /\/user-profile/.test(page.url()) && !/login|otp/.test(body),
        weight: 5,
        detail: page.url(),
      },
    ];
  }

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
