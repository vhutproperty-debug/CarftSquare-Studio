import type { BrowserContext, Cookie } from 'playwright';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { decryptResearchPayload, encryptResearchPayload } from '@/lib/research/crypto';

export type StorageStatePayload = {
  cookies?: Cookie[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

export class SessionLoader {
  encryptCookies(cookies: Cookie[], portal = 'unknown'): string {
    connectorLog(portal, 'encryption', { cookieCount: cookies.length });
    return encryptResearchPayload(cookies);
  }

  decryptCookies(encoded?: string, portal = 'unknown'): Cookie[] {
    if (!encoded) {
      connectorLog(portal, 'decrypt', { ok: false, cookieCount: 0, reason: 'missing' }, 'warn');
      return [];
    }
    try {
      const cookies = decryptResearchPayload<Cookie[]>(encoded);
      connectorLog(portal, 'decrypt', { ok: true, cookieCount: cookies.length });
      return cookies;
    } catch (error) {
      connectorLog(
        portal,
        'decrypt',
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        'error',
      );
      throw error;
    }
  }

  encryptStorage(storage: StorageStatePayload): string {
    return encryptResearchPayload(storage);
  }

  decryptStorage(encoded?: string): StorageStatePayload {
    if (!encoded) return {};
    return decryptResearchPayload<StorageStatePayload>(encoded);
  }

  async applyToContext(
    context: BrowserContext,
    input: { encryptedCookies?: string; encryptedStorage?: string; portal?: string },
  ): Promise<void> {
    const portal = input.portal || 'unknown';
    const cookies = this.decryptCookies(input.encryptedCookies, portal);
    if (cookies.length) {
      await context.addCookies(cookies);
    }

    const storage = this.decryptStorage(input.encryptedStorage);
    for (const originEntry of storage.origins || []) {
      if (!originEntry.localStorage?.length) continue;
      const page = await context.newPage();
      try {
        await page.goto(originEntry.origin, { waitUntil: 'domcontentloaded' });
        await page.evaluate((items) => {
          for (const item of items) {
            window.localStorage.setItem(item.name, item.value);
          }
        }, originEntry.localStorage);
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  }

  async captureFromContext(
    context: BrowserContext,
    portal = 'unknown',
  ): Promise<{
    encryptedCookies: string;
    encryptedStorage: string;
    cookieCount: number;
  }> {
    const state = await context.storageState();
    const cookies = state.cookies as Cookie[];
    connectorLog(portal, 'cookie_capture', { cookieCount: cookies.length });
    return {
      encryptedCookies: this.encryptCookies(cookies, portal),
      encryptedStorage: this.encryptStorage({
        cookies,
        origins: state.origins,
      }),
      cookieCount: cookies.length,
    };
  }
}
