import { v4 as uuidv4 } from 'uuid';
import { RESEARCH_PORTALS } from '@/lib/research/browser/config';
import { compareProperties } from '@/lib/research/ai/comparison';
import { dedupeAcrossPortals } from '@/lib/research/ai/dedupe';
import { mergeCriteria, understandResearchIntent } from '@/lib/research/ai/intent';
import { polishAnalystMessage } from '@/lib/research/ai/narrative';
import { searchPortalsInParallel } from '@/lib/research/ai/parallel-search';
import { applySessionFilters } from '@/lib/research/ai/post-filters';
import { buildResearchReport } from '@/lib/research/ai/report';
import { scoreListings } from '@/lib/research/ai/scoring';
import {
  createAiSession,
  getAiSessionById,
  listAiSessions,
  saveAiSession,
} from '@/lib/research/ai/session-store';
import {
  advancedKnowledgeSearch,
  enrichKnowledgeGraph,
  kgPropertiesToListings,
  parseAdvancedKnowledgeQuery,
  queryKnownProperties,
} from '@/lib/research/graph';
import { buildProactiveInsights } from '@/lib/research/monitoring/insights';
import { listTrends } from '@/lib/research/monitoring/trend-engine';
import { createResearchQuery } from '@/lib/research/store/queries';
import { createResearchRun, updateResearchRun } from '@/lib/research/store/runs';
import { createResearchResult } from '@/lib/research/store/results';
import type {
  ResearchAiActivityEvent,
  ResearchAiDecisionAudit,
  ResearchAiMessage,
  ResearchAiProgress,
  ResearchAiSession,
  ResearchListing,
  ResearchPlanCriteria,
  ResearchScoredListing,
} from '@/lib/research/types';

export type ExecutiveTurnResult = {
  session: ResearchAiSession;
  assistantMessage: string;
  clarification?: string;
};

/**
 * Executive AI Property Research Analyst.
 * Orchestrates intent → strategy → parallel portal search → analyze → report.
 * Never exposes internal tooling details to the UI.
 */
export class ExecutiveResearchAgent {
  readonly name = 'ExecutiveResearchAgent' as const;

  async createSession(input: {
    workspaceId: string;
    createdBy: string;
    title?: string;
  }): Promise<ResearchAiSession> {
    return createAiSession(input);
  }

  async getSession(sessionId: string): Promise<ResearchAiSession | null> {
    return getAiSessionById(sessionId);
  }

  async listSessions(workspaceId: string): Promise<ResearchAiSession[]> {
    return listAiSessions(workspaceId);
  }

  async handleMessage(input: {
    sessionId: string;
    message: string;
  }): Promise<ExecutiveTurnResult> {
    const session = await getAiSessionById(input.sessionId);
    if (!session) throw new Error('Research session not found.');

    const userMsg = msg('user', input.message.trim());
    session.messages.push(userMsg);

    session.progress = progress('understanding', 8, 'Understanding your request…', {
      activity: appendActivity([], {
        message: 'Understanding your request…',
        status: 'running',
      }),
    });
    await saveAiSession(session);

    const intent = understandResearchIntent(
      input.message,
      session.filters,
      session.exclusions,
    );

    audit(session, 'understand_intent', 'Parsed user intent into structured filters.', {
      interpretedAs: intent.interpretedAs,
      compareProjects: intent.compareProjects,
    });

    if (intent.needsClarification && !intent.isFollowUp) {
      session.status = 'needs_clarification';
      session.clarificationQuestion = intent.clarificationQuestion;
      session.progress = progress('needs_clarification', 10, intent.clarificationQuestion || 'Need more detail');
      const assistant = await polishAnalystMessage({
        draft: intent.clarificationQuestion || 'Could you share BHK, budget, and project or locality?',
        facts: intent.interpretedAs,
      });
      session.messages.push(msg('assistant', assistant));
      await saveAiSession(session);
      return { session, assistantMessage: assistant, clarification: intent.clarificationQuestion };
    }

    session.filters = mergeCriteria(session.filters, {
      ...intent.criteriaDelta,
      exclusions: intent.exclusions,
    });
    session.exclusions = intent.exclusions;
    if (intent.interpretedAs.length) {
      session.goals = Array.from(new Set([...session.goals, ...intent.interpretedAs]));
    }
    if (!session.filters.city) session.filters.city = 'Mumbai';
    if (!session.filters.transactionType) {
      session.filters.transactionType = 'RENT';
      session.assumptions.push('Assumed rent search (not stated).');
    }
    if (!session.filters.portals?.length) {
      session.filters.portals = RESEARCH_PORTALS.map((p) => p.key);
      session.assumptions.push('Searching all configured portals.');
    }
    session.title = session.title === 'New research session'
      ? input.message.slice(0, 80)
      : session.title;
    session.status = 'running';
    session.clarificationQuestion = undefined;

    // Phase 4: knowledge-graph advanced search (no browser) when query is historical/intel
    const kgQuery = parseAdvancedKnowledgeQuery(input.message, session.workspaceId);
    if (kgQuery) {
      session.progress = progress('analyzing', 40, 'Querying property knowledge graph…');
      await saveAiSession(session);
      const known = await advancedKnowledgeSearch(kgQuery);
      let scored = scoreListings(
        kgPropertiesToListings(known),
        session.filters,
        session.exclusions,
      );
      scored = applySessionFilters(scored, session.filters, session.exclusions);
      session.listings = scored;
      audit(session, 'knowledge_graph_search', 'Answered from accumulated knowledge graph.', {
        count: known.length,
        query: kgQuery,
      });
      const report = buildResearchReport({
        session,
        listings: scored,
        duplicatesRemoved: 0,
        portalsSearched: ['knowledge-graph'],
        portalErrors: [],
      });
      session.report = report;
      session.status = 'completed';
      session.progress = progress('completed', 100, 'Knowledge graph results ready.', {
        listingsCollected: scored.length,
      });
      const draft = [
        `I used the property knowledge graph (not a fresh portal crawl).`,
        `Found ${scored.length} matching propert${scored.length === 1 ? 'y' : 'ies'} from prior research observations.`,
        scored[0]
          ? `Top match: “${scored[0].title || 'Listing'}” — ${scored[0].explanation}`
          : 'No matching historical properties for that filter yet.',
      ].join(' ');
      const assistant = await polishAnalystMessage({
        draft,
        facts: [`kg_matches=${scored.length}`, ...intent.interpretedAs],
      });
      session.messages.push(msg('assistant', assistant));
      await saveAiSession(session);
      return { session, assistantMessage: assistant };
    }

    const projects =
      session.filters.projects?.length
        ? session.filters.projects
        : session.filters.project
          ? [session.filters.project]
          : [undefined];

    // Phase 4: reuse known intelligence before launching browsers
    const priorKnown = await queryKnownProperties(session.workspaceId, session.filters, 30);
    if (priorKnown.length) {
      session.assumptions.push(
        `Knowledge graph has ${priorKnown.length} prior matching propert${priorKnown.length === 1 ? 'y' : 'ies'}; fetching incremental portal updates.`,
      );
      audit(session, 'knowledge_graph_prefetch', 'Loaded prior graph matches before browser research.', {
        count: priorKnown.length,
      });
    }

    session.progress = progress(
      'planning',
      20,
      projects.length > 1
        ? `Planning ${projects.length} comparative searches…`
        : 'Planning portal research…',
      {
        portalsTotal: session.filters.portals!.length * projects.length,
        activity: appendActivity(session.progress?.activity, {
          message: 'Expanding search intent and selecting portals…',
          status: 'running',
        }),
      },
    );
    await saveAiSession(session);

    const allRaw: ResearchListing[] = priorKnown.length
      ? kgPropertiesToListings(priorKnown)
      : [];
    const portalErrors: Array<{ portal: string; message: string }> = [];
    const portalsSearched = new Set<string>();
    let portalsDone = 0;
    const portalsTotal = session.filters.portals!.length * projects.length;

    for (const project of projects) {
      const criteria: ResearchPlanCriteria = {
        ...session.filters,
        project: project || session.filters.project,
        projects: undefined,
      };

      const query = await createResearchQuery({
        workspaceId: session.workspaceId,
        title: `${project || criteria.locality || 'Research'} — ${criteria.bhk || '?'} BHK`,
        naturalLanguage: input.message,
        createdBy: session.createdBy,
        plan: {
          criteria,
          steps: [],
          interpretedAs: intent.interpretedAs,
        },
      });
      session.queryIds.push(query.id);

      const run = await createResearchRun({
        workspaceId: session.workspaceId,
        queryId: query.id,
        portalKeys: criteria.portals,
      });
      session.runIds.push(run.id);
      await updateResearchRun(run.id, {
        status: 'running',
        startedAt: new Date().toISOString(),
      });

      session.progress = progress(
        'searching',
        35,
        `Searching portals${project ? ` for ${project}` : ''}…`,
        {
          portalsTotal,
          portalsDone,
          activity: appendActivity(session.progress?.activity, {
            message: project
              ? `Searching portals for ${project}…`
              : 'Searching Housing, MagicBricks, 99acres, NoBroker, Square Yards…',
            status: 'running',
          }),
        },
      );
      await saveAiSession(session);

      // Serialize portal activity writes — parallel onPortalDone must not race-overwrite progress.activity.
      let activityWriteChain: Promise<void> = Promise.resolve();
      let listingsCollectedAcc = session.progress?.listingsCollected || 0;

      const { listings, outcomes } = await searchPortalsInParallel({
        workspaceId: session.workspaceId,
        criteria,
        portals: criteria.portals || [],
        onPortalDone: async (done, total, portal, outcome) => {
          const portalLabel = portalDisplayName(portal);
          const activityMsg = outcome.ok
            ? `${portalLabel} returned ${outcome.listings.length} listing${outcome.listings.length === 1 ? '' : 's'}.`
            : `${portalLabel} unavailable — ${outcome.message || 'failed'}. Continuing with healthy connectors.`;

          activityWriteChain = activityWriteChain.then(async () => {
            portalsDone = Math.min(portalsTotal, done);
            const prior = session.progress?.activity || [];
            // Skip duplicate portal completion lines if the same portal already recorded.
            if (prior.some((e) => e.portal === portal && (e.status === 'ok' || e.status === 'fail'))) {
              return;
            }
            if (outcome.ok) {
              listingsCollectedAcc += outcome.listings.length;
            }
            session.progress = progress(
              'searching',
              35 + Math.round((done / Math.max(total, 1)) * 35),
              activityMsg,
              {
                portalsTotal,
                portalsDone,
                listingsCollected: listingsCollectedAcc,
                activity: appendActivity(prior, {
                  message: activityMsg,
                  status: outcome.ok ? 'ok' : 'fail',
                  portal,
                  count: outcome.listings.length,
                }),
              },
            );
            await saveAiSession(session);
          });
          // Never fail portal search because timeline persistence failed.
          await activityWriteChain.catch(() => undefined);
        },
      });

      for (const outcome of outcomes) {
        portalsSearched.add(outcome.portal);
        if (!outcome.ok) {
          portalErrors.push({ portal: outcome.portal, message: outcome.message || 'failed' });
        }
      }
      allRaw.push(
        ...listings.map((l) =>
          project && !l.projectName ? { ...l, projectName: project } : l,
        ),
      );

      await updateResearchRun(run.id, {
        status: 'completed',
        listingCount: listings.length,
        finishedAt: new Date().toISOString(),
      });
    }

    session.progress = progress('analyzing', 75, 'Deduplicating and scoring…', {
      portalsTotal,
      portalsDone: portalsTotal,
      listingsCollected: allRaw.length,
      activity: appendActivity(session.progress?.activity, {
        message: 'Removing duplicates and matching project aliases…',
        status: 'running',
      }),
    });
    await saveAiSession(session);

    const { unique, duplicatesRemoved } = dedupeAcrossPortals(allRaw);
    let scored = scoreListings(unique, session.filters, session.exclusions);
    scored = applySessionFilters(scored, session.filters, session.exclusions);
    session.listings = scored;

    audit(session, 'analyze_results', 'Deduped, scored, and filtered listings from portal extracts only.', {
      raw: allRaw.length,
      unique: unique.length,
      afterFilters: scored.length,
      duplicatesRemoved,
      priorKnown: priorKnown.length,
    });

    session.progress = progress('analyzing', 82, 'Updating property knowledge graph…', {
      portalsTotal,
      portalsDone: portalsTotal,
      listingsCollected: scored.length,
      duplicatesRemoved,
      activity: appendActivity(session.progress?.activity, {
        message: `Calculating confidence, comparing prices, ranking ${scored.length} opportunities…`,
        status: 'running',
        count: scored.length,
      }),
    });
    await saveAiSession(session);

    const lastRunId = session.runIds[session.runIds.length - 1];
    let enrichmentSummary = {
      propertiesUpserted: 0,
      observationsAppended: 0,
      changesDetected: 0,
    };
    try {
      const enrichment = await enrichKnowledgeGraph({
        workspaceId: session.workspaceId,
        researchSessionId: session.id,
        runId: lastRunId,
        // Prefer fresh portal extracts; fall back to graph-known rows when portals returned nothing.
        listings: scored.filter((l) => !String(l.id).startsWith('kg:')).length
          ? scored.filter((l) => !String(l.id).startsWith('kg:'))
          : scored,
      });
      enrichmentSummary = enrichment;
      audit(session, 'knowledge_graph_enrichment', 'Resolved identities and appended observations.', {
        ...enrichment,
      });
    } catch (error) {
      audit(session, 'knowledge_graph_enrichment_failed', 'Graph enrichment failed; research results preserved.', {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    session.progress = progress('reporting', 90, 'Preparing research report…', {
      portalsTotal,
      portalsDone: portalsTotal,
      listingsCollected: scored.length,
      duplicatesRemoved,
      activity: appendActivity(session.progress?.activity, {
        message: 'Preparing executive report and generating final answer…',
        status: 'running',
      }),
    });
    await saveAiSession(session);

    const report = buildResearchReport({
      session,
      listings: scored,
      duplicatesRemoved,
      portalsSearched: Array.from(portalsSearched),
      portalErrors,
    });
    session.report = report;
    session.status =
      !scored.length && portalErrors.length === portalsSearched.size
        ? 'failed'
        : 'completed';
    session.progress = progress(
      session.status === 'completed' ? 'completed' : 'failed',
      100,
      session.status === 'completed' ? 'Research report ready.' : 'Research incomplete.',
      {
        portalsTotal,
        portalsDone: portalsTotal,
        listingsCollected: scored.length,
        duplicatesRemoved,
        activity: appendActivity(session.progress?.activity, {
          message:
            session.status === 'completed'
              ? 'Research complete — executive report ready.'
              : 'Research incomplete — reconnect failed portals and retry.',
          status: session.status === 'completed' ? 'ok' : 'fail',
        }),
      },
    );

    // Persist aggregate result against last run for audit trail
    const lastQueryId = session.queryIds[session.queryIds.length - 1];
    if (lastRunId && lastQueryId) {
      await createResearchResult({
        workspaceId: session.workspaceId,
        runId: lastRunId,
        queryId: lastQueryId,
        summary: report.executiveSummary,
        listings: scored,
        payload: {
          sessionId: session.id,
          report,
          portalErrors,
          duplicatesRemoved,
          knowledgeGraph: enrichmentSummary,
        },
      });
    }

    let proactiveInsights: string[] = [];
    try {
      const trends = await listTrends(session.workspaceId, 8);
      proactiveInsights = buildProactiveInsights(trends).slice(0, 3);
      if (proactiveInsights.length) {
        audit(session, 'proactive_insights', 'Evidence-based trend observations attached.', {
          count: proactiveInsights.length,
        });
      }
    } catch {
      /* trends are optional for on-demand research replies */
    }

    const draft = buildAssistantReply(
      session,
      scored,
      duplicatesRemoved,
      portalErrors,
      priorKnown.length,
      enrichmentSummary,
      proactiveInsights,
    );
    const facts = [
      `unique_listings=${scored.length}`,
      `duplicates_removed=${duplicatesRemoved}`,
      `confidence=${report.researchConfidence}`,
      `kg_prior=${priorKnown.length}`,
      `kg_changes=${enrichmentSummary.changesDetected}`,
      `top=${scored[0]?.title || 'none'}`,
      `top_score=${scored[0]?.relevanceScore ?? 'n/a'}`,
      ...intent.interpretedAs,
    ];
    const assistant = await polishAnalystMessage({ draft, facts });
    session.messages.push(msg('assistant', assistant));
    await saveAiSession(session);

    return { session, assistantMessage: assistant };
  }

  compareSessionListings(session: ResearchAiSession, listingIds?: string[]) {
    const selected = listingIds?.length
      ? session.listings.filter((l) => listingIds.includes(l.id))
      : session.listings.slice(0, 3);
    return compareProperties(selected);
  }
}

function msg(role: ResearchAiMessage['role'], content: string): ResearchAiMessage {
  return { id: uuidv4(), role, content, createdAt: new Date().toISOString() };
}

function audit(
  session: ResearchAiSession,
  action: string,
  rationale: string,
  evidence?: Record<string, unknown>,
): void {
  const entry: ResearchAiDecisionAudit = {
    id: uuidv4(),
    action,
    rationale,
    evidence,
    createdAt: new Date().toISOString(),
  };
  session.auditLog.push(entry);
}

function progress(
  phase: ResearchAiProgress['phase'],
  percent: number,
  message: string,
  extra?: Partial<ResearchAiProgress>,
): ResearchAiProgress {
  return {
    phase,
    percent,
    message,
    portalsTotal: extra?.portalsTotal || 0,
    portalsDone: extra?.portalsDone || 0,
    listingsCollected: extra?.listingsCollected || 0,
    duplicatesRemoved: extra?.duplicatesRemoved || 0,
    activity: extra?.activity,
    estimatedCompletionAt:
      percent < 100
        ? new Date(Date.now() + (100 - percent) * 800).toISOString()
        : undefined,
    updatedAt: new Date().toISOString(),
  };
}

function appendActivity(
  prior: ResearchAiActivityEvent[] | undefined,
  event: Omit<ResearchAiActivityEvent, 'id' | 'at'>,
): ResearchAiActivityEvent[] {
  const next: ResearchAiActivityEvent = {
    id: uuidv4(),
    at: new Date().toISOString(),
    ...event,
  };
  return [...(prior || []), next].slice(-40);
}

function portalDisplayName(portal: string): string {
  const labels: Record<string, string> = {
    housing: 'Housing',
    magicbricks: 'MagicBricks',
    '99acres': '99acres',
    nobroker: 'NoBroker',
    squareyards: 'Square Yards',
  };
  return labels[portal] || portal;
}

function buildAssistantReply(
  session: ResearchAiSession,
  listings: ResearchScoredListing[],
  duplicatesRemoved: number,
  portalErrors: Array<{ portal: string; message: string }>,
  priorKnown = 0,
  enrichment?: { propertiesUpserted: number; changesDetected: number },
  proactiveInsights: string[] = [],
): string {
  const report = session.report!;
  if (!listings.length) {
    return [
      'I finished the research pass but could not collect usable listings from authenticated portals.',
      portalErrors.length
        ? `Issues: ${portalErrors.map((e) => e.portal).join(', ')}. Please reconnect those portals, then ask me to continue.`
        : 'No portal results matched the current filters.',
      'I have not invented any inventory.',
    ].join(' ');
  }

  const top = listings[0]!;
  const lines = [
    `I completed the research. ${listings.length} unique propert${listings.length === 1 ? 'y' : 'ies'} after removing ${duplicatesRemoved} cross-portal duplicate(s).`,
    priorKnown
      ? `Reused ${priorKnown} prior knowledge-graph match(es) and refreshed with live portal data.`
      : undefined,
    `Top match: “${top.title || 'Listing'}” (score ${top.relevanceScore}/100). ${top.explanation}`,
    report.marketInsights.averageAskingRent != null
      ? `Among listings with extracted rents, average asking is ₹${report.marketInsights.averageAskingRent.toLocaleString('en-IN')}.`
      : 'Average rent is not available because prices were missing on collected listings.',
    enrichment
      ? `Knowledge graph updated: ${enrichment.propertiesUpserted} propert${enrichment.propertiesUpserted === 1 ? 'y' : 'ies'}, ${enrichment.changesDetected} change(s) detected.`
      : undefined,
    ...proactiveInsights.map((insight) => `Market watch: ${insight}`),
    `Research confidence: ${report.researchConfidence}/100.`,
    'You can refine this session, ask knowledge-graph questions (e.g. “show properties with price drops”), or export the client report.',
  ].filter(Boolean) as string[];
  return lines.join(' ');
}

export const executiveResearchAgent = new ExecutiveResearchAgent();
