import type { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';
import { BasePortalConnector } from '@/connectors/common/base-connector';
import {
  collectGenericListings,
  detectListedBy,
  parseBhk,
  parseMoney,
} from '@/connectors/common/listing-parser';
import type { LoginConfidenceSignal } from '@/connectors/common/login-confidence';
import { buildPortalSearchUrl } from '@/connectors/common/search-url';
import type { ConnectorSearchRequest, ResearchListing } from '@/lib/research/types';

/**
 * MagicBricks — same BasePortalConnector + connect-auth-engine path as
 * NoBroker / Square Yards. Cross-host auth (accounts.* → www.*) is handled by
 * the shared verify-host probe in worker-runtime; CAPTCHA/OTP by connect-auth-engine.
 */
export class MagicbricksConnector extends BasePortalConnector {
  readonly key = 'magicbricks';
  readonly displayName = 'MagicBricks';

  getLoginUrl(): string {
    return 'https://accounts.magicbricks.com/userauth/login';
  }

  /**
   * Prefer homepage for verify — myMagicBox / activity URLs often trip Akamai
   * 403 Access Denied on datacenter egress even with valid SSO cookies.
   */
  getVerifyUrl(): string {
    return 'https://www.magicbricks.com/';
  }

  protected async portalAuthExtraSignals(page: Page): Promise<LoginConfidenceSignal[]> {
    const body = (await page.content().catch(() => '')).toLowerCase();
    const url = page.url().toLowerCase();
    const title = (await page.title().catch(() => '')).toLowerCase();
    return [
      {
        name: 'magicbricks_logout',
        pass: /log\s*out|sign\s*out/.test(body),
        weight: 15,
      },
      {
        name: 'magicbricks_my_activity',
        pass: /my\s*activity|my\s*property|post\s*property|my\s*magic\s*box/.test(body),
        weight: 10,
      },
      {
        name: 'magicbricks_not_on_auth_host',
        pass: !/accounts\.magicbricks\.com/.test(url),
        weight: 10,
      },
      {
        name: 'magicbricks_not_access_denied',
        pass: !/access\s*denied/.test(body) && !/access\s*denied/.test(title),
        weight: 20,
      },
    ];
  }

  protected buildSearchUrl(criteria: ConnectorSearchRequest['criteria']): string {
    return buildPortalSearchUrl(this.key, criteria);
  }

  protected async parseListingsFromPage(page: Page, portal: string): Promise<ResearchListing[]> {
    const cards = await page
      .evaluate((max) => {
        const nodes = Array.from(
          document.querySelectorAll(
            '.mb-srp__card, .srpTuple, .m-srp-card, [class*="mb-srp__list"] > div',
          ),
        ).slice(0, max);
        return nodes.map((el) => {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          const linkEl = el.querySelector(
            'a[href*="property"], a[href*="Property"], a[href]',
          ) as HTMLAnchorElement | null;
          const titleEl = el.querySelector(
            'h2, h3, .mb-srp__card--title, [class*="title"]',
          ) as HTMLElement | null;
          const priceEl = el.querySelector(
            '[class*="price"], .mb-srp__card__price',
          ) as HTMLElement | null;
          return {
            title: (titleEl?.textContent || '').trim() || text.slice(0, 120),
            price: (priceEl?.textContent || '').trim(),
            text,
            link: linkEl?.href || '',
          };
        });
      }, 40)
      .catch(() => [] as Array<{ title: string; price: string; text: string; link: string }>);

    if (cards.length >= 3) {
      return cards.map((row) => {
        const price = parseMoney(row.price) ?? parseMoney(row.text);
        const bhk = parseBhk(row.title) ?? parseBhk(row.text);
        return {
          id: `${portal}:${row.link || uuidv4()}`,
          portal,
          title: row.title || 'Listing',
          configuration: bhk != null ? `${bhk} BHK` : undefined,
          bhk,
          rent: price,
          salePrice: price,
          url: row.link || undefined,
          rawText: row.text.slice(0, 500),
          listedBy: detectListedBy(row.text),
        } satisfies ResearchListing;
      });
    }

    return collectGenericListings(page, portal);
  }
}

export const magicbricksConnector = new MagicbricksConnector();
