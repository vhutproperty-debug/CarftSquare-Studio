import type { Page } from 'playwright';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import { collectGenericListings } from '@/connectors/common/listing-parser';
import type { LoginConfidenceSignal } from '@/connectors/common/login-confidence';
import { buildPortalSearchUrl } from '@/connectors/common/search-url';
import { connectorLog } from '@/lib/research/browser/connector-log';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

const PHONE_INPUT = '#signUp-phoneNumber';

export class NobrokerConnector extends BasePortalConnector {
  readonly key = 'nobroker';
  readonly displayName = 'NoBroker';

  getLoginUrl(): string {
    return 'https://www.nobroker.in/';
  }

  getVerifyUrl(): string {
    return 'https://www.nobroker.in/';
  }

  /**
   * NoBroker has no dedicated login document — OTP lives in a homepage modal.
   * Click header "Log in" then wait for the phone field.
   */
  async ensureConnectLoginSurface(page: Page): Promise<void> {
    const already = await page.locator(PHONE_INPUT).first().isVisible().catch(() => false);
    if (already) {
      connectorLog(this.key, 'connect_login_surface_already_open', { selector: PHONE_INPUT });
      return;
    }

    const selectors = [
      'a:has-text("Log in")',
      'button:has-text("Log in")',
      'text=Log in',
      'a:has-text("Login")',
      'text=Sign up',
    ];

    let clicked: string | null = null;
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count().catch(() => 0)) === 0) continue;
      try {
        await loc.click({ timeout: 3_000 });
        clicked = sel;
        break;
      } catch {
        /* try next */
      }
    }

    if (!clicked) {
      connectorLog(this.key, 'connect_login_surface_click_miss', {}, 'warn');
      throw new Error(
        'NoBroker: could not open login modal — Log in control not found on homepage',
      );
    }

    await page.waitForSelector(PHONE_INPUT, { state: 'visible', timeout: 15_000 });
    connectorLog(this.key, 'connect_login_surface_opened', {
      clicked,
      selector: PHONE_INPUT,
      url: page.url(),
    });
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
