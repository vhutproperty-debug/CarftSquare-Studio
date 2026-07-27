import { createHash } from 'crypto';
import type { BrowserContext, Cookie } from 'playwright';
import { connectorLog } from '@/lib/research/browser/connector-log';
import { researchPerfLog, researchPerfNow } from '@/lib/research/browser/perf';
import { decryptResearchPayload, encryptResearchPayload } from '@/lib/research/crypto';
import { recordSessionRestore } from '@/lib/research/ops/metrics';

export type StorageStatePayload = {
  cookies?: Cookie[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

export function secretsFingerprint(
  encryptedCookies?: string,
  encryptedStorage?: string,
): string {
  return createHash('sha256')
    .update(encryptedCookies || '')
    .update('|')
    .update(encryptedStorage || '')
    .digest('hex')
    .slice(0, 24);
}

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
      const t0 = researchPerfNow();
      const cookies = decryptResearchPayload<Cookie[]>(encoded);
      researchPerfLog('cookie_decrypt', t0, { portal, cookieCount: cookies.length });
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
    const t0 = researchPerfNow();

    // Prefer full Playwright storageState when encryptedStorage carries cookies + origins.
    const storage = this.decryptStorage(input.encryptedStorage);
    const stateCookies = (storage.cookies || []) as Cookie[];
    const legacyCookies = stateCookies.length
      ? stateCookies
      : this.decryptCookies(input.encryptedCookies, portal);

    try {
      if (legacyCookies.length) {
        const tInject = researchPerfNow();
        await context.addCookies(legacyCookies);
        researchPerfLog('cookie_injection', tInject, {
          portal,
          cookieCount: legacyCookies.length,
          source: stateCookies.length ? 'storageState' : 'encryptedCookies',
        });
        connectorLog(portal, 'storage_state_restore', {
          cookieCount: legacyCookies.length,
          origins: (storage.origins || []).length,
          source: stateCookies.length ? 'storageState' : 'encryptedCookies',
        });
      }

      const origins = (storage.origins || []).filter((o) => o.localStorage?.length);
      if (origins.length) {
        const page = await context.newPage();
        try {
          for (const originEntry of origins) {
            await page.goto(originEntry.origin, { waitUntil: 'domcontentloaded' });
            await page.evaluate(
              `((items) => { for (const item of items) { window.localStorage.setItem(item.name, item.value); } })(${JSON.stringify(
                originEntry.localStorage,
              )})`,
            );
          }
        } finally {
          await page.close().catch(() => undefined);
        }
      }
      researchPerfLog('session_apply', t0, {
        portal,
        origins: origins.length,
        cookieCount: legacyCookies.length,
      });
      if (legacyCookies.length || origins.length) {
        recordSessionRestore(true);
      }
    } catch (error) {
      recordSessionRestore(false);
      throw error;
    }
  }

  /**
   * Capture Playwright storageState (cookies + origins/localStorage) and encrypt.
   * encryptedStorage is the canonical session blob; encryptedCookies is derived for compat.
   */
  async captureFromContext(
    context: BrowserContext,
    portal = 'unknown',
  ): Promise<{
    encryptedCookies: string;
    encryptedStorage: string;
    cookieCount: number;
    storageStateOrigins: number;
  }> {
    const state = await context.storageState();
    const cookies = state.cookies as Cookie[];
    const origins = state.origins?.length ?? 0;
    connectorLog(portal, 'storage_state_capture', {
      cookieCount: cookies.length,
      origins,
    });
    return {
      encryptedCookies: this.encryptCookies(cookies, portal),
      encryptedStorage: this.encryptStorage({
        cookies,
        origins: state.origins,
      }),
      cookieCount: cookies.length,
      storageStateOrigins: origins,
    };
  }
}
