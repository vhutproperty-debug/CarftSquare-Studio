import type { Page, BrowserContext } from 'playwright';

/** Rich DOM/cookie signals collected each login-wait poll. */
export type PageAuthProbe = {
  url: string;
  bodySnippet: string;
  cookieCount: number;
  readyState: string;
  hasAvatar: boolean;
  hasAccountName: boolean;
  hasEditProfile: boolean;
  hasLogout: boolean;
  hasProfileLink: boolean;
  hasLoginForm: boolean;
  profileSelectors: string[];
};

/**
 * Collect authentication signals from a live Playwright page.
 * Used only by the Connect login-wait loop — never exposes cookie values.
 */
export async function collectPageAuthProbe(
  page: Page,
  context: BrowserContext,
): Promise<PageAuthProbe> {
  const url = page.url();
  const cookies = await context.cookies().catch(() => []);
  // Prefer host-scoped cookies; count is enough (values never logged).
  const cookieCount = cookies.filter((c) => {
    const d = (c.domain || '').toLowerCase();
    return !d || d.includes('housing') || d.includes('99acres') || d.includes('magicbricks');
  }).length || cookies.length;

  const dom = await page
    .evaluate(() => {
      const text = (document.body?.innerText || '').toLowerCase();
      const html = (document.documentElement?.outerHTML || '').toLowerCase();
      const readyState = document.readyState || 'unknown';

      const avatarSelectors = [
        'img[alt*="profile" i]',
        'img[alt*="avatar" i]',
        'img[class*="avatar" i]',
        'img[class*="profile" i]',
        '[class*="avatar"] img',
        '[class*="Avatar"] img',
        '[data-testid*="avatar" i]',
        'img[src*="avatar"]',
        'img[src*="profile"]',
        'img[src*="user"]',
        '[class*="user-image" i] img',
        '[class*="profile-image" i] img',
        '[class*="profilePic" i]',
        '[class*="profile-pic" i]',
      ];
      const editHrefSelectors = [
        'a[href*="edit-profile" i]',
        'a[href*="editprofile" i]',
        'a[href*="profile/edit" i]',
        'a[href*="edit" i][href*="profile" i]',
      ];
      const logoutHrefSelectors = [
        'a[href*="logout" i]',
        'a[href*="signout" i]',
        'a[href*="sign-out" i]',
        'button[class*="logout" i]',
      ];

      const foundSelectors: string[] = [];
      const hasSel = (sel: string) => {
        try {
          return Boolean(document.querySelector(sel));
        } catch {
          return false;
        }
      };

      let hasAvatar = false;
      for (const sel of avatarSelectors) {
        if (hasSel(sel)) {
          hasAvatar = true;
          foundSelectors.push(sel);
          break;
        }
      }
      // Circular/profile image fallback common on Housing account headers.
      if (!hasAvatar) {
        const imgs = Array.from(document.querySelectorAll('img')).slice(0, 40);
        for (const img of imgs) {
          const alt = (img.getAttribute('alt') || '').toLowerCase();
          const cls = (img.getAttribute('class') || '').toLowerCase();
          const src = (img.getAttribute('src') || '').toLowerCase();
          if (
            /avatar|profile|user|photo|picture/.test(`${alt} ${cls} ${src}`) ||
            (img.width > 0 && img.width <= 120 && img.height > 0 && img.height <= 120 && /user|profile|account/.test(location.pathname))
          ) {
            hasAvatar = true;
            foundSelectors.push('img:profile-heuristic');
            break;
          }
        }
      }

      const hasEditProfile =
        /edit\s*profile|update\s*profile|manage\s*profile/.test(text) ||
        editHrefSelectors.some((sel) => hasSel(sel));
      if (hasEditProfile) foundSelectors.push('edit-profile');

      let hasLogout = false;
      for (const sel of logoutHrefSelectors) {
        if (hasSel(sel)) {
          hasLogout = true;
          foundSelectors.push(sel);
          break;
        }
      }
      if (!hasLogout && /(log\s*out|sign\s*out|signout)/.test(text)) {
        hasLogout = true;
        foundSelectors.push('text:logout');
      }

      const hasProfileLink =
        hasSel('a[href*="user-profile"]') ||
        hasSel('a[href*="/my-profile"]') ||
        /my\s*profile|user\s*profile|view\s*profile|account\s*settings/.test(text);
      if (hasProfileLink) foundSelectors.push('profile-link');

      // Account name: profile headings / name nodes (exclude login CTAs).
      const nameCandidates = Array.from(
        document.querySelectorAll(
          'h1, h2, h3, [class*="profile-name" i], [class*="user-name" i], [class*="userName" i], [class*="account-name" i], [data-testid*="name" i]',
        ),
      )
        .map((el) => (el.textContent || '').trim())
        .filter((t) => t.length >= 2 && t.length <= 80);
      const looksLikeLoginCta = (t: string) =>
        /sign\s*in|log\s*in|enter\s*otp|phone\s*number|get\s*otp|verify|continue|housing\.com/i.test(
          t,
        );
      let hasAccountName = nameCandidates.some((t) => !looksLikeLoginCta(t));
      // On /user-profile after login, visible personal name often sits in a short text node.
      if (!hasAccountName && /user-profile|my-profile|\/profile/.test(location.pathname)) {
        const shortLines = text
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length >= 2 && l.length <= 48);
        hasAccountName = shortLines.some(
          (l) =>
            !looksLikeLoginCta(l) &&
            !/edit\s*profile|log\s*out|settings|notifications|wishlist|saved|help|support/.test(
              l,
            ) &&
            /^[a-z][a-z\s.'.-]{1,46}$/i.test(l),
        );
        if (hasAccountName) foundSelectors.push('text:account-name-heuristic');
      }
      if (hasAccountName && !foundSelectors.includes('text:account-name-heuristic')) {
        foundSelectors.push('account-name');
      }

      const hasLoginForm =
        Boolean(document.querySelector('input[type="password"]')) ||
        Boolean(
          document.querySelector(
            'input[name*="otp" i], input[placeholder*="otp" i], input[autocomplete="one-time-code"]',
          ),
        ) ||
        (/enter\s*otp|enter\s*password|get\s*otp|request\s*otp|verify\s*otp/.test(text) &&
          Boolean(document.querySelector('input')));

      return {
        readyState,
        hasAvatar,
        hasAccountName,
        hasEditProfile,
        hasLogout,
        hasProfileLink,
        hasLoginForm,
        profileSelectors: foundSelectors.slice(0, 12),
        bodySnippet: `${text.slice(0, 2000)}\n${html.slice(0, 2000)}`,
      };
    })
    .catch(() => ({
      readyState: 'unknown',
      hasAvatar: false,
      hasAccountName: false,
      hasEditProfile: false,
      hasLogout: false,
      hasProfileLink: false,
      hasLoginForm: false,
      profileSelectors: [] as string[],
      bodySnippet: '',
    }));

  return {
    url,
    bodySnippet: dom.bodySnippet,
    cookieCount,
    readyState: dom.readyState,
    hasAvatar: dom.hasAvatar,
    hasAccountName: dom.hasAccountName,
    hasEditProfile: dom.hasEditProfile,
    hasLogout: dom.hasLogout,
    hasProfileLink: dom.hasProfileLink,
    hasLoginForm: dom.hasLoginForm,
    profileSelectors: dom.profileSelectors,
  };
}
