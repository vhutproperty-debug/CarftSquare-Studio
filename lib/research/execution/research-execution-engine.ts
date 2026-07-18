import { requirePortalConnector } from '@/connectors/registry';
import { researchPlanner } from '@/lib/research/planner/research-planner';
import {
  createResearchQuery,
  getResearchQueryById,
  setResearchQueryStatus,
  updateResearchQuery,
} from '@/lib/research/store/queries';
import { createResearchResult } from '@/lib/research/store/results';
import {
  createResearchRun,
  getResearchRunById,
  setResearchRunStatus,
  updateResearchRun,
} from '@/lib/research/store/runs';
import type {
  ResearchListing,
  ResearchPlanSnapshot,
  ResearchQuery,
  ResearchRun,
} from '@/lib/research/types';

function filterListings(
  listings: ResearchListing[],
  criteria: ResearchPlanSnapshot['criteria'],
): ResearchListing[] {
  return listings.filter((listing) => {
    if (criteria.bhk != null && listing.bhk != null && listing.bhk !== criteria.bhk) {
      return false;
    }
    if (criteria.maxBudget != null) {
      const price = listing.rent ?? listing.salePrice;
      if (price != null && price > criteria.maxBudget) return false;
    }
    if (criteria.minBudget != null) {
      const price = listing.rent ?? listing.salePrice;
      if (price != null && price < criteria.minBudget) return false;
    }
    if (criteria.project) {
      const hay = `${listing.title || ''} ${listing.projectName || ''} ${listing.rawText || ''}`.toLowerCase();
      const needle = criteria.project.toLowerCase();
      // Keep if project unknown or fuzzy match
      if (listing.projectName && !hay.includes(needle.split(' ')[0]!)) {
        /* soft filter — do not drop aggressively */
      }
    }
    return true;
  });
}

/**
 * Orchestrates plan → validate sessions → search portals → persist results.
 */
export class ResearchExecutionEngine {
  async planAndCreateQuery(input: {
    workspaceId: string;
    naturalLanguage: string;
    createdBy: string;
    title?: string;
  }): Promise<{ query: ResearchQuery; plan: ResearchPlanSnapshot }> {
    const draft: ResearchQuery = {
      id: 'pending',
      workspaceId: input.workspaceId,
      title: input.title || input.naturalLanguage.slice(0, 80),
      naturalLanguage: input.naturalLanguage,
      status: 'draft',
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const plan = await researchPlanner.buildPlan(draft);
    const snapshot: ResearchPlanSnapshot = {
      criteria: plan.criteria,
      steps: plan.steps,
      interpretedAs: plan.interpretedAs,
    };
    const query = await createResearchQuery({
      workspaceId: input.workspaceId,
      title: draft.title,
      naturalLanguage: input.naturalLanguage,
      createdBy: input.createdBy,
      plan: snapshot,
    });
    return { query, plan: snapshot };
  }

  async executeQuery(queryId: string): Promise<{
    run: ResearchRun;
    listings: ResearchListing[];
  }> {
    const query = await getResearchQueryById(queryId);
    if (!query) throw new Error('Research query not found.');

    let plan = query.plan;
    if (!plan) {
      const built = await researchPlanner.buildPlan(query);
      plan = {
        criteria: built.criteria,
        steps: built.steps,
        interpretedAs: built.interpretedAs,
      };
      await updateResearchQuery(query.id, { plan });
    }

    const portalKeys = plan.criteria.portals || [];
    const run = await createResearchRun({
      workspaceId: query.workspaceId,
      queryId: query.id,
      portalKeys,
    });

    await setResearchQueryStatus(query.id, 'running');
    await setResearchRunStatus(run.id, 'running', {
      startedAt: new Date().toISOString(),
    });

    const allListings: ResearchListing[] = [];
    const portalErrors: Array<{ portal: string; message: string }> = [];
    const portals = Array.from(
      new Set(
        plan.steps
          .filter((s) => s.action === 'execute_search')
          .map((s) => s.connectorKey),
      ),
    );

    for (const portal of portals) {
      try {
        const connector = requirePortalConnector(portal);
        const validation = await connector.validateSession(query.workspaceId);
        if (!validation.ok) {
          portalErrors.push({
            portal,
            message: validation.message || `Session ${validation.status}`,
          });
          continue;
        }
        const response = await connector.executeSearch({
          workspaceId: query.workspaceId,
          criteria: plan.criteria,
          sessionId: validation.sessionId,
        });
        if (!response.ok) {
          portalErrors.push({
            portal,
            message: response.message || 'Search failed',
          });
          continue;
        }
        allListings.push(...filterListings(response.listings, plan.criteria));
      } catch (error) {
        portalErrors.push({
          portal,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const unique = dedupeListings(allListings);
    const summary =
      unique.length > 0
        ? `Collected ${unique.length} listing(s) across ${portals.length} portal(s).`
        : portalErrors.length
          ? `No listings collected. ${portalErrors.length} portal issue(s).`
          : 'No listings matched the plan criteria.';

    await createResearchResult({
      workspaceId: query.workspaceId,
      runId: run.id,
      queryId: query.id,
      summary,
      listings: unique,
      payload: {
        interpretedAs: plan.interpretedAs,
        criteria: plan.criteria,
        portalErrors,
      },
    });

    const failed = unique.length === 0 && portalErrors.length > 0 && portalErrors.length === portals.length;
    const finishedAt = new Date().toISOString();
    const updated = await updateResearchRun(run.id, {
      status: failed ? 'failed' : 'completed',
      listingCount: unique.length,
      finishedAt,
      errorMessage: failed
        ? portalErrors.map((e) => `${e.portal}: ${e.message}`).join('; ')
        : undefined,
    });
    await setResearchQueryStatus(query.id, failed ? 'failed' : 'completed');

    return {
      run: updated || (await getResearchRunById(run.id))!,
      listings: unique,
    };
  }
}

function dedupeListings(listings: ResearchListing[]): ResearchListing[] {
  const seen = new Set<string>();
  const out: ResearchListing[] = [];
  for (const listing of listings) {
    const key = listing.url || listing.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(listing);
  }
  return out;
}

export const researchExecutionEngine = new ResearchExecutionEngine();
