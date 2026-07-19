import fs from 'fs/promises';
import path from 'path';
import type { Page, BrowserContext, Frame } from 'playwright';

/** Rich DOM/cookie signals collected each login-wait poll. */
export type PageAuthProbe = {
  url: string;
  title: string;
  bodySnippet: string;
  cookieCount: number;
  readyState: string;
  settled: boolean;
  networkIdleMs: number;
  iframeCount: number;
  shadowHostCount: number;
  hasAvatar: boolean;
  hasAccountName: boolean;
  hasEditProfile: boolean;
  hasLogout: boolean;
  hasProfileLink: boolean;
  hasLoginForm: boolean;
  profileSelectors: string[];
  /** Every selector/heuristic attempted this poll. */
  attemptedSelectors: string[];
  /** Short candidate dumps when a signal fails (for log comparison). */
  candidates: {
    avatars: string[];
    names: string[];
    editProfile: string[];
    links: string[];
  };
  evaluateError?: string;
  htmlSnapshotPath?: string;
  screenshotPath?: string;
};

export type PageAuthProbeOptions = {
  /** Wait for readyState=complete and ≥2s network idle before probing. */
  settle?: boolean;
  settleTimeoutMs?: number;
  /** Directory to write HTML + screenshot artifacts. */
  artifactDir?: string;
  pollIndex?: number;
  log?: (line: string) => void;
};

const AVATAR_SELECTORS = [
  'img[alt*="profile"]',
  'img[alt*="avatar"]',
  'img[class*="avatar"]',
  'img[class*="profile"]',
  '[class*="avatar"] img',
  '[data-testid*="avatar"]',
  'img[src*="avatar"]',
  'img[src*="profile"]',
  'img[src*="user"]',
  '[class*="user-image"] img',
  '[class*="profile-image"] img',
  '[class*="profilePic"]',
  '[class*="profile-pic"]',
];

const EDIT_SELECTORS = [
  'a[href*="edit-profile"]',
  'a[href*="editprofile"]',
  'a[href*="profile/edit"]',
  'a[href*="edit"][href*="profile"]',
  'button[class*="edit"]',
];

const LOGOUT_SELECTORS = [
  'a[href*="logout"]',
  'a[href*="signout"]',
  'a[href*="sign-out"]',
  'button[class*="logout"]',
];

const NAME_SELECTORS = [
  'h1',
  'h2',
  'h3',
  '[class*="profile-name"]',
  '[class*="user-name"]',
  '[class*="userName"]',
  '[class*="account-name"]',
  '[data-testid*="name"]',
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait until document.readyState === "complete" and network has been idle ≥2s.
 */
export async function waitForPageSettled(
  page: Page,
  opts: { timeoutMs?: number; idleMs?: number; log?: (line: string) => void } = {},
): Promise<{ readyState: string; networkIdleMs: number; settled: boolean }> {
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const idleMs = opts.idleMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;
  const log = opts.log;

  await page
    .waitForFunction(() => document.readyState === 'complete', {
      timeout: Math.max(1_000, timeoutMs - 2_000),
    })
    .catch(() => undefined);

  // Playwright networkidle ≈ 500ms quiet; then require a full idleMs window.
  await page.waitForLoadState('networkidle', { timeout: Math.max(1_000, timeoutMs / 2) }).catch(() => {
    log?.('page_settle networkidle_wait_timed_out — continuing with quiet-window check');
  });

  let pending = 0;
  const onRequest = () => {
    pending += 1;
  };
  const onDone = () => {
    pending = Math.max(0, pending - 1);
  };
  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  let quietSince = Date.now();
  try {
    while (Date.now() < deadline) {
      const readyState = await page.evaluate(() => document.readyState).catch(() => 'unknown');
      if (pending > 0) {
        quietSince = Date.now();
      }
      const quietFor = Date.now() - quietSince;
      if (readyState === 'complete' && pending === 0 && quietFor >= idleMs) {
        log?.(
          `page_settle readyState=${readyState} networkIdleMs=${quietFor} pending=${pending}`,
        );
        return { readyState, networkIdleMs: quietFor, settled: true };
      }
      await sleep(200);
    }
  } finally {
    page.off('request', onRequest);
    page.off('requestfinished', onDone);
    page.off('requestfailed', onDone);
  }

  const readyState = await page.evaluate(() => document.readyState).catch(() => 'unknown');
  // Soft settle: Housing analytics can keep sockets busy; if the document is
  // complete after the full wait, allow scoring rather than stalling forever.
  const soft = readyState === 'complete';
  log?.(
    `page_settle_timeout readyState=${readyState} pending≈${pending} softSettle=${soft}`,
  );
  return { readyState, networkIdleMs: pending === 0 ? idleMs : 0, settled: soft };
}

type FrameDomScan = {
  frameUrl: string;
  readyState: string;
  iframeCount: number;
  shadowHostCount: number;
  hasAvatar: boolean;
  hasAccountName: boolean;
  hasEditProfile: boolean;
  hasLogout: boolean;
  hasProfileLink: boolean;
  hasLoginForm: boolean;
  matchedSelectors: string[];
  attemptedSelectors: string[];
  candidates: {
    avatars: string[];
    names: string[];
    editProfile: string[];
    links: string[];
  };
  textSample: string;
  htmlSample: string;
  error?: string;
};

async function scanFrameDom(frame: Frame): Promise<FrameDomScan> {
  const frameUrl = frame.url();
  try {
    return await frame.evaluate(
      ({ avatarSelectors, editSelectors, logoutSelectors, nameSelectors }) => {
        const attemptedSelectors: string[] = [
          ...avatarSelectors.map((s) => `avatar:${s}`),
          ...editSelectors.map((s) => `edit:${s}`),
          ...logoutSelectors.map((s) => `logout:${s}`),
          ...nameSelectors.map((s) => `name:${s}`),
          'text:edit profile',
          'text:logout',
          'heuristic:img-profile',
          'heuristic:account-name-lines',
          'shadow:walk',
          'iframe:count',
        ];

        const candidates = {
          avatars: [] as string[],
          names: [] as string[],
          editProfile: [] as string[],
          links: [] as string[],
        };
        const matchedSelectors: string[] = [];

        const hasSel = (root: ParentNode, sel: string) => {
          try {
            return Boolean(root.querySelector(sel));
          } catch {
            return false;
          }
        };

        /** Collect open shadow roots recursively. */
        const roots: ParentNode[] = [document];
        let shadowHostCount = 0;
        const walkShadows = (node: ParentNode) => {
          const els = (node as Document | ShadowRoot).querySelectorAll
            ? Array.from((node as Document | Element).querySelectorAll('*'))
            : [];
          for (const el of els) {
            const sr = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
            if (sr) {
              shadowHostCount += 1;
              roots.push(sr);
              walkShadows(sr);
            }
          }
        };
        walkShadows(document);

        const iframeCount = document.querySelectorAll('iframe').length;

        const collectText = (root: ParentNode) => {
          try {
            if (root === document) return (document.body?.innerText || '').toLowerCase();
            return ((root as ShadowRoot).textContent || '').toLowerCase();
          } catch {
            return '';
          }
        };

        let text = '';
        for (const root of roots) text += `\n${collectText(root)}`;
        text = text.toLowerCase();

        let hasAvatar = false;
        for (const sel of avatarSelectors) {
          for (const root of roots) {
            if (hasSel(root, sel)) {
              hasAvatar = true;
              matchedSelectors.push(`avatar:${sel}`);
              break;
            }
          }
          if (hasAvatar) break;
        }

        // Candidate dump: first N images across roots
        for (const root of roots) {
          const imgs = Array.from(root.querySelectorAll('img')).slice(0, 25);
          for (const img of imgs) {
            const alt = img.getAttribute('alt') || '';
            const cls = img.getAttribute('class') || '';
            const src = (img.getAttribute('src') || '').slice(0, 120);
            const w = (img as HTMLImageElement).width || 0;
            const h = (img as HTMLImageElement).height || 0;
            candidates.avatars.push(`alt="${alt}" class="${cls.slice(0, 80)}" src="${src}" ${w}x${h}`);
            if (!hasAvatar) {
              const blob = `${alt} ${cls} ${src}`.toLowerCase();
              if (
                /avatar|profile|user|photo|picture/.test(blob) ||
                (w > 0 && w <= 128 && h > 0 && h <= 128 && /user-profile|profile|account/.test(location.pathname))
              ) {
                hasAvatar = true;
                matchedSelectors.push('heuristic:img-profile');
              }
            }
          }
        }
        candidates.avatars = candidates.avatars.slice(0, 12);

        let hasEditProfile = /edit\s*profile|update\s*profile|manage\s*profile/.test(text);
        if (hasEditProfile) matchedSelectors.push('text:edit profile');
        for (const sel of editSelectors) {
          for (const root of roots) {
            if (hasSel(root, sel)) {
              hasEditProfile = true;
              matchedSelectors.push(`edit:${sel}`);
            }
          }
        }
        // Candidate dump: anchors/buttons mentioning edit/profile
        for (const root of roots) {
          const nodes = Array.from(root.querySelectorAll('a,button,[role="button"]')).slice(0, 80);
          for (const el of nodes) {
            const label = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 80);
            const href = (el as HTMLAnchorElement).getAttribute?.('href') || '';
            if (/edit|profile/i.test(`${label} ${href}`)) {
              candidates.editProfile.push(`"${label}" href=${href.slice(0, 100)}`);
            }
          }
        }
        candidates.editProfile = candidates.editProfile.slice(0, 12);

        let hasLogout = /log\s*out|sign\s*out|signout/.test(text);
        if (hasLogout) matchedSelectors.push('text:logout');
        for (const sel of logoutSelectors) {
          for (const root of roots) {
            if (hasSel(root, sel)) {
              hasLogout = true;
              matchedSelectors.push(`logout:${sel}`);
            }
          }
        }

        let hasProfileLink =
          /my\s*profile|user\s*profile|view\s*profile|account\s*settings/.test(text);
        for (const root of roots) {
          if (hasSel(root, 'a[href*="user-profile"]') || hasSel(root, 'a[href*="/my-profile"]')) {
            hasProfileLink = true;
            matchedSelectors.push('profile-link');
          }
          const links = Array.from(root.querySelectorAll('a[href]')).slice(0, 40);
          for (const a of links) {
            const href = a.getAttribute('href') || '';
            const label = (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
            if (/profile|account|logout|login/i.test(`${href} ${label}`)) {
              candidates.links.push(`"${label}" href=${href.slice(0, 100)}`);
            }
          }
        }
        candidates.links = candidates.links.slice(0, 12);

        const looksLikeLoginCta = (t: string) =>
          /sign\s*in|log\s*in|enter\s*otp|phone\s*number|get\s*otp|verify|continue|housing\.com/i.test(
            t,
          );

        let hasAccountName = false;
        for (const sel of nameSelectors) {
          for (const root of roots) {
            const nodes = Array.from(root.querySelectorAll(sel)).slice(0, 10);
            for (const el of nodes) {
              const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
              if (t.length >= 2 && t.length <= 80) {
                candidates.names.push(`[${sel}] ${t}`);
                if (!looksLikeLoginCta(t)) {
                  hasAccountName = true;
                  matchedSelectors.push(`name:${sel}`);
                }
              }
            }
          }
        }
        if (!hasAccountName && /user-profile|my-profile|\/profile/.test(location.pathname)) {
          const shortLines = text
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length >= 2 && l.length <= 48);
          for (const l of shortLines.slice(0, 30)) {
            candidates.names.push(`[line] ${l}`);
          }
          hasAccountName = shortLines.some(
            (l) =>
              !looksLikeLoginCta(l) &&
              !/edit\s*profile|log\s*out|settings|notifications|wishlist|saved|help|support/.test(
                l,
              ) &&
              /^[a-z][a-z\s.'.-]{1,46}$/i.test(l),
          );
          if (hasAccountName) matchedSelectors.push('heuristic:account-name-lines');
        }
        candidates.names = candidates.names.slice(0, 12);

        const hasLoginForm =
          Boolean(document.querySelector('input[type="password"]')) ||
          Boolean(
            document.querySelector(
              'input[name*="otp"], input[placeholder*="otp"], input[autocomplete="one-time-code"]',
            ),
          ) ||
          (/enter\s*otp|enter\s*password|get\s*otp|request\s*otp|verify\s*otp/.test(text) &&
            Boolean(document.querySelector('input')));

        const html = (document.documentElement?.outerHTML || '').slice(0, 6000);

        return {
          frameUrl: location.href,
          readyState: document.readyState || 'unknown',
          iframeCount,
          shadowHostCount,
          hasAvatar,
          hasAccountName,
          hasEditProfile,
          hasLogout,
          hasProfileLink,
          hasLoginForm,
          matchedSelectors,
          attemptedSelectors,
          candidates,
          textSample: text.slice(0, 2500),
          htmlSample: html,
        };
      },
      {
        avatarSelectors: AVATAR_SELECTORS,
        editSelectors: EDIT_SELECTORS,
        logoutSelectors: LOGOUT_SELECTORS,
        nameSelectors: NAME_SELECTORS,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      frameUrl,
      readyState: 'unknown',
      iframeCount: 0,
      shadowHostCount: 0,
      hasAvatar: false,
      hasAccountName: false,
      hasEditProfile: false,
      hasLogout: false,
      hasProfileLink: false,
      hasLoginForm: false,
      matchedSelectors: [],
      attemptedSelectors: [],
      candidates: { avatars: [], names: [], editProfile: [], links: [] },
      textSample: '',
      htmlSample: '',
      error: message,
    };
  }
}

async function playwrightTextSignals(page: Page): Promise<{
  hasEditProfile: boolean;
  hasLogout: boolean;
  hasAccountNameHint: boolean;
  matched: string[];
}> {
  const matched: string[] = [];
  const visible = async (locator: ReturnType<Page['getByText']>) => {
    try {
      const n = await locator.count();
      if (n === 0) return false;
      return locator.first().isVisible({ timeout: 500 });
    } catch {
      return false;
    }
  };

  const hasEditProfile = await visible(page.getByText(/edit\s*profile/i));
  if (hasEditProfile) matched.push('pw:text=Edit Profile');

  const hasLogout = await visible(page.getByText(/log\s*out|sign\s*out/i));
  if (hasLogout) matched.push('pw:text=Logout');

  // Name hint: visible text near profile chrome (not login CTAs).
  let hasAccountNameHint = false;
  try {
    const heading = page.locator('h1, h2, h3').first();
    if (await heading.isVisible({ timeout: 500 }).catch(() => false)) {
      const t = ((await heading.innerText()) || '').trim();
      if (
        t.length >= 2 &&
        t.length <= 80 &&
        !/sign\s*in|log\s*in|enter\s*otp|phone/i.test(t)
      ) {
        hasAccountNameHint = true;
        matched.push(`pw:heading=${t.slice(0, 40)}`);
      }
    }
  } catch {
    /* ignore */
  }

  return { hasEditProfile, hasLogout, hasAccountNameHint, matched };
}

/**
 * Collect authentication signals from a live Playwright page.
 * Used only by the Connect login-wait loop — never exposes cookie values.
 */
export async function collectPageAuthProbe(
  page: Page,
  context: BrowserContext,
  options: PageAuthProbeOptions = {},
): Promise<PageAuthProbe> {
  const log = options.log;
  let settled = !options.settle;
  let networkIdleMs = 0;
  let readyState = 'unknown';

  if (options.settle !== false) {
    const settle = await waitForPageSettled(page, {
      timeoutMs: options.settleTimeoutMs ?? 20_000,
      idleMs: 2_000,
      log,
    });
    settled = settle.settled;
    networkIdleMs = settle.networkIdleMs;
    readyState = settle.readyState;
  }

  const url = page.url();
  const title = await page.title().catch(() => '');
  const cookies = await context.cookies().catch(() => []);
  const cookieCount =
    cookies.filter((c) => {
      const d = (c.domain || '').toLowerCase();
      return !d || d.includes('housing') || d.includes('99acres') || d.includes('magicbricks');
    }).length || cookies.length;

  log?.(
    `page_inspect url=${url} title=${JSON.stringify(title)} readyState=${readyState} settled=${settled} networkIdleMs=${networkIdleMs} frames=${page.frames().length}`,
  );

  // Do not score-quality-scan until settled; still return structural diagnostics.
  const frames = page.frames();
  const scans: FrameDomScan[] = [];
  for (const frame of frames) {
    const scan = await scanFrameDom(frame);
    scans.push(scan);
    if (scan.error) {
      log?.(`frame_scan_error url=${scan.frameUrl} error=${scan.error}`);
    } else {
      log?.(
        `frame_scan url=${scan.frameUrl} readyState=${scan.readyState} iframes=${scan.iframeCount} shadowHosts=${scan.shadowHostCount} avatar=${scan.hasAvatar} name=${scan.hasAccountName} edit=${scan.hasEditProfile}`,
      );
    }
  }

  const pw = await playwrightTextSignals(page);
  if (pw.matched.length) {
    log?.(`pw_text_signals ${pw.matched.join('|')}`);
  }

  const merged = scans.reduce(
    (acc, s) => ({
      hasAvatar: acc.hasAvatar || s.hasAvatar,
      hasAccountName: acc.hasAccountName || s.hasAccountName,
      hasEditProfile: acc.hasEditProfile || s.hasEditProfile,
      hasLogout: acc.hasLogout || s.hasLogout,
      hasProfileLink: acc.hasProfileLink || s.hasProfileLink,
      hasLoginForm: acc.hasLoginForm || s.hasLoginForm,
      iframeCount: acc.iframeCount + s.iframeCount,
      shadowHostCount: acc.shadowHostCount + s.shadowHostCount,
      matchedSelectors: [...acc.matchedSelectors, ...s.matchedSelectors],
      attemptedSelectors: [...acc.attemptedSelectors, ...s.attemptedSelectors],
      candidates: {
        avatars: [...acc.candidates.avatars, ...s.candidates.avatars].slice(0, 16),
        names: [...acc.candidates.names, ...s.candidates.names].slice(0, 16),
        editProfile: [...acc.candidates.editProfile, ...s.candidates.editProfile].slice(0, 16),
        links: [...acc.candidates.links, ...s.candidates.links].slice(0, 16),
      },
      textSample: acc.textSample || s.textSample,
      htmlSample: acc.htmlSample || s.htmlSample,
      evaluateError: acc.evaluateError || s.error,
    }),
    {
      hasAvatar: false,
      hasAccountName: false,
      hasEditProfile: false,
      hasLogout: false,
      hasProfileLink: false,
      hasLoginForm: false,
      iframeCount: 0,
      shadowHostCount: 0,
      matchedSelectors: [] as string[],
      attemptedSelectors: [] as string[],
      candidates: {
        avatars: [] as string[],
        names: [] as string[],
        editProfile: [] as string[],
        links: [] as string[],
      },
      textSample: '',
      htmlSample: '',
      evaluateError: undefined as string | undefined,
    },
  );

  // Playwright locators pierce open shadow DOM — merge those wins.
  if (pw.hasEditProfile) merged.hasEditProfile = true;
  if (pw.hasLogout) merged.hasLogout = true;
  if (pw.hasAccountNameHint) merged.hasAccountName = true;
  merged.matchedSelectors.push(...pw.matched);

  // Raw HTML fallback — prefer concrete markup, not loose JS-bundle tokens.
  const rawHtml = await page.content().catch(() => '');
  if (
    !merged.hasEditProfile &&
    (/>\s*edit\s*profile\s*</i.test(rawHtml) ||
      /href=["'][^"']*edit[^"']*profile[^"']*["']/i.test(rawHtml))
  ) {
    merged.hasEditProfile = true;
    merged.matchedSelectors.push('html:edit-profile');
  }
  if (
    !merged.hasLogout &&
    (/>\s*(log\s*out|sign\s*out)\s*</i.test(rawHtml) ||
      /href=["'][^"']*logout[^"']*["']/i.test(rawHtml))
  ) {
    merged.hasLogout = true;
    merged.matchedSelectors.push('html:logout');
  }
  if (
    !merged.hasAvatar &&
    /<img\b[^>]*(?:alt|class|src)=["'][^"']*(?:avatar|profile(?:pic|[-_]?photo|[-_]?image)?|user[-_]?image)[^"']*["']/i.test(
      rawHtml,
    )
  ) {
    merged.hasAvatar = true;
    merged.matchedSelectors.push('html:img-avatar');
  }

  const mainReady =
    scans.find((s) => s.frameUrl === url)?.readyState ||
    scans[0]?.readyState ||
    readyState;
  if (mainReady && mainReady !== 'unknown') readyState = mainReady;

  let htmlSnapshotPath: string | undefined;
  let screenshotPath: string | undefined;
  if (options.artifactDir) {
    const poll = options.pollIndex ?? 0;
    await fs.mkdir(options.artifactDir, { recursive: true });
    htmlSnapshotPath = path.join(options.artifactDir, `poll-${poll}.html`);
    screenshotPath = path.join(options.artifactDir, `poll-${poll}.jpg`);
    const fullHtml = await page.content().catch(() => merged.htmlSample || '');
    const frameDump = scans
      .map(
        (s, i) =>
          `\n<!-- FRAME ${i} url=${s.frameUrl} ready=${s.readyState} iframes=${s.iframeCount} shadows=${s.shadowHostCount} err=${s.error || ''} -->\n${s.htmlSample}`,
      )
      .join('\n');
    await fs
      .writeFile(
        htmlSnapshotPath,
        `<!-- url=${url} title=${title} readyState=${readyState} settled=${settled} -->\n${fullHtml}\n${frameDump}`,
        'utf8',
      )
      .catch(() => undefined);
    await page
      .screenshot({ path: screenshotPath, type: 'jpeg', quality: 55, fullPage: false })
      .catch(() => undefined);
    log?.(
      `page_artifacts html=${htmlSnapshotPath} screenshot=${screenshotPath} htmlBytes=${fullHtml.length}`,
    );
  }

  // When DOM signals fail, dump candidates + attempted selectors for comparison.
  if (!merged.hasAvatar || !merged.hasAccountName || !merged.hasEditProfile) {
    log?.(
      `selector_miss avatar=${merged.hasAvatar} name=${merged.hasAccountName} edit=${merged.hasEditProfile} attempted=${[...new Set(merged.attemptedSelectors)].join(',')}`,
    );
    if (!merged.hasAvatar) {
      log?.(
        `avatar_candidates ${merged.candidates.avatars.join(' || ') || '(none)'}`,
      );
    }
    if (!merged.hasAccountName) {
      log?.(
        `name_candidates ${merged.candidates.names.join(' || ') || '(none)'}`,
      );
    }
    if (!merged.hasEditProfile) {
      log?.(
        `edit_candidates ${merged.candidates.editProfile.join(' || ') || '(none)'}`,
      );
    }
    log?.(`link_candidates ${merged.candidates.links.join(' || ') || '(none)'}`);
  }

  return {
    url,
    title,
    bodySnippet: `${merged.textSample}\n${merged.htmlSample}`.slice(0, 4000).toLowerCase(),
    cookieCount,
    readyState,
    settled,
    networkIdleMs,
    iframeCount: merged.iframeCount,
    shadowHostCount: merged.shadowHostCount,
    hasAvatar: merged.hasAvatar,
    hasAccountName: merged.hasAccountName,
    hasEditProfile: merged.hasEditProfile,
    hasLogout: merged.hasLogout,
    hasProfileLink: merged.hasProfileLink,
    hasLoginForm: merged.hasLoginForm,
    profileSelectors: [...new Set(merged.matchedSelectors)].slice(0, 20),
    attemptedSelectors: [...new Set(merged.attemptedSelectors)].slice(0, 60),
    candidates: merged.candidates,
    evaluateError: merged.evaluateError,
    htmlSnapshotPath,
    screenshotPath,
  };
}
