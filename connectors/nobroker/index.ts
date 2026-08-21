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

    // SPA hydration: header controls mount late (page title stays empty for a while).
    await page
      .waitForFunction(() => document.querySelectorAll('a,button').length > 10, undefined, {
        timeout: 20_000,
      })
      .catch(() => undefined);

    const selectors = [
      'a:has-text("Log in")',
      'button:has-text("Log in")',
      'a:has-text("Login")',
      'button:has-text("Login")',
      'a:has-text("Sign In")',
      'button:has-text("Sign In")',
      'text=/sign\\s*in/i',
      'text=/log\\s*in/i',
      'text=Sign up',
      '[class*="signin" i]',
      '[class*="login" i][role="button"]',
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
    await page
      .waitForSelector(
        'a[href*="/property/rent/"], a[href*="/property/sale/"], a[href*="/property/buy/"]',
        { timeout: 12_000 },
      )
      .catch(() => undefined);
    return collectGenericListings(page, portal);
  }
}

export const nobrokerConnector = new NobrokerConnector();
