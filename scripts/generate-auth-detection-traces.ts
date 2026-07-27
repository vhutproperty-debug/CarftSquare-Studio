/**
 * Generate per-portal authentication detection traces (evidence only).
 *
 * Usage:
 *   npx tsx scripts/generate-auth-detection-traces.ts
 *   npx tsx scripts/generate-auth-detection-traces.ts --live
 *
 * --live: if encrypted cookies exist, open Chromium and collect live evidence
 *         (requires local Playwright host, not Vercel).
 */

import fs from 'fs/promises';
import path from 'path';
import { loadEnvLocal } from './lib/load-env-local.mjs';
import {
  buildStaticAuthLossTrace,
  writePortalAuthTrace,
  collectPageAuthEvidence,
  type PortalAuthTrace,
} from '../lib/research/auth-detection/auth-evidence';
import { RESEARCH_PORTALS } from '../lib/research/browser/config';
import { isServerlessPlaywrightHost } from '../lib/research/browser/playwright-runtime-guard';
import { DEFAULT_RESEARCH_WORKSPACE } from '../lib/research/business';
import { findBrowserSession } from '../lib/research/sessions/session-store';
import { browserSessionManager } from '../lib/research/sessions/browser-session-manager';
import { researchBrowserManager } from '../lib/research/browser/browser-manager';

loadEnvLocal();

const OUT = path.join(process.cwd(), 'tmp', 'auth-traces');
const live = process.argv.includes('--live');

function looksLoggedOutEvidence(url: string): {
  trips: boolean;
  reason: string;
} {
  const u = url.toLowerCase();
  const loginSignals = ['login', 'sign in', 'otp', 'password', 'verify'];
  for (const s of loginSignals) {
    if (u.includes(s) && !u.includes('profile')) {
      return {
        trips: true,
        reason: `url.includes("${s}") && !url.includes("profile") → looksLoggedOut=true`,
      };
    }
  }
  return { trips: false, reason: 'URL does not trip looksLoggedOut' };
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });

  const summary: Array<{
    portal: string;
    loginUrl: string;
    looksLoggedOutOnLoginUrl: boolean;
    firstAuthLossPoint: string;
    rootCause: string | null;
    tracePath: string;
    liveRan: boolean;
  }> = [];

  for (const portal of RESEARCH_PORTALS) {
    const staticTrace = buildStaticAuthLossTrace(portal.key);
    const urlCheck = looksLoggedOutEvidence(portal.loginUrl);

    // Enrich static trace with exact code evidence.
    staticTrace.pipelineNotes.push(
      `CODE: browser-session-manager.ts looksLoggedOut() — ${urlCheck.reason}`,
    );
    staticTrace.pipelineNotes.push(
      'CODE: worker-runtime.ts upsertBrowserSession(... sessionStatus: "needs_login") BEFORE validateSession',
    );
    staticTrace.pipelineNotes.push(
      'CODE: worker-runtime.ts await handle.close(); await removeConnectProfileDir(profileDir); THEN validate',
    );

    let trace: PortalAuthTrace = staticTrace;
    let liveRan = false;

    if (live && !isServerlessPlaywrightHost()) {
      const session = await findBrowserSession(DEFAULT_RESEARCH_WORKSPACE, portal.key);
      if (session?.encryptedCookies) {
        liveRan = true;
        const managed = await browserSessionManager.getOrCreate(
          DEFAULT_RESEARCH_WORKSPACE,
          portal.key,
        );
        const outcome = await researchBrowserManager.withPage(
          managed,
          `auth-trace-${portal.key}`,
          async (page) => {
            await page.goto(portal.loginUrl, { waitUntil: 'domcontentloaded' });
            return collectPageAuthEvidence(page, {
              portal: portal.key,
              phase: 'live_restore_validate_probe',
              loginUrl: portal.loginUrl,
              waitedExtraSettleMs: 4_000,
            });
          },
        );
        if (outcome.result) {
          trace = outcome.result;
          trace.sessionRestore = {
            cookiesRestored: Boolean(session.encryptedCookies),
            storageRestored: Boolean(session.encryptedStorage),
            cookieCount: trace.cookies.count,
            profileRestored: true,
            urlAfterRestore: trace.page.url,
            loginConfidence: trace.confidence.total,
          };
          trace.sessionSave = {
            cookiesEncryptedBytes: session.encryptedCookies?.length ?? 0,
            storageEncryptedBytes: session.encryptedStorage?.length ?? 0,
            profileDirectory: session.browserProfile || null,
            mongoOk: true,
            note: 'Loaded existing Mongo encrypted session for live probe',
          };
          // Keep static root-cause if live also trips login URL heuristic.
          if (!trace.rootCauseHypothesis && staticTrace.rootCauseHypothesis) {
            trace.rootCauseHypothesis = staticTrace.rootCauseHypothesis;
          }
          if (urlCheck.trips && !trace.failureReport?.firstAuthLossPoint.includes('looksLoggedOut')) {
            trace.pipelineNotes.push(
              `STATIC+LIVE: loginUrl still trips looksLoggedOut (${urlCheck.reason})`,
            );
          }
        } else {
          staticTrace.pipelineNotes.push(
            `LIVE probe error: ${outcome.error?.message || 'unknown'}`,
          );
        }
      } else {
        staticTrace.pipelineNotes.push(
          'LIVE skipped: no encryptedCookies in Mongo for this portal',
        );
      }
    }

    const tracePath = await writePortalAuthTrace(trace, OUT);
    summary.push({
      portal: portal.key,
      loginUrl: portal.loginUrl,
      looksLoggedOutOnLoginUrl: urlCheck.trips,
      firstAuthLossPoint:
        trace.failureReport?.firstAuthLossPoint ||
        staticTrace.failureReport?.firstAuthLossPoint ||
        'n/a',
      rootCause: trace.rootCauseHypothesis,
      tracePath,
      liveRan,
    });
    console.log(
      JSON.stringify(
        {
          portal: portal.key,
          looksLoggedOutOnLoginUrl: urlCheck.trips,
          firstAuthLossPoint: summary[summary.length - 1].firstAuthLossPoint,
          tracePath,
          liveRan,
        },
        null,
        2,
      ),
    );
  }

  const indexPath = path.join(OUT, '_auth-detection-summary.json');
  const firstLossAcross = summary.filter((s) => s.looksLoggedOutOnLoginUrl);
  await fs.writeFile(
    indexPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        verdict:
          firstLossAcross.length > 0
            ? `FIRST AUTH LOSS POINT (evidence): looksLoggedOut() URL heuristic on loginUrl during validateSession. Affected: ${firstLossAcross
                .map((s) => s.portal)
                .join(', ')}`
            : 'No portal loginUrl trips looksLoggedOut by URL alone — inspect live confidence traces.',
        dualDetectors: {
          connectWait: 'lib/research/browser-gateway/login-detect.ts AUTH_SCORE_THRESHOLD=6',
          validateSession:
            'lib/research/auth-detection/auth-evidence.ts + login-confidence.ts threshold=60',
        },
        portals: summary,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\nSummary: ${indexPath}`);
  console.log(
    firstLossAcross.length
      ? `\nROOT CAUSE: looksLoggedOut short-circuit on loginUrl for: ${firstLossAcross
          .map((s) => s.portal)
          .join(', ')}`
      : '\nNo URL short-circuit; see per-portal traces.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
