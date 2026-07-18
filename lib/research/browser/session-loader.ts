import type { BrowserContext, Cookie } from 'playwright';
import { decryptResearchPayload, encryptResearchPayload } from '@/lib/research/crypto';

export type StorageStatePayload = {
  cookies?: Cookie[];
  origins?: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
};

export class SessionLoader {
  encryptCookies(cookies: Cookie[]): string {
    return encryptResearchPayload(cookies);
  }

  decryptCookies(encoded?: string): Cookie[] {
    if (!encoded) return [];
    return decryptResearchPayload<Cookie[]>(encoded);
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
    input: { encryptedCookies?: string; encryptedStorage?: string },
  ): Promise<void> {
    const cookies = this.decryptCookies(input.encryptedCookies);
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

  async captureFromContext(context: BrowserContext): Promise<{
    encryptedCookies: string;
    encryptedStorage: string;
  }> {
    const state = await context.storageState();
    return {
      encryptedCookies: this.encryptCookies(state.cookies as Cookie[]),
      encryptedStorage: this.encryptStorage({
        cookies: state.cookies as Cookie[],
        origins: state.origins,
      }),
    };
  }
}
