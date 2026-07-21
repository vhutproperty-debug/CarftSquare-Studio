import { requirePortalConnector } from '@/connectors/registry';
import type {
  ResearchListing,
  ResearchPlanCriteria,
} from '@/lib/research/types';

export type PortalSearchOutcome = {
  portal: string;
  ok: boolean;
  listings: ResearchListing[];
  message?: string;
};

/**
 * Parallel portal search using Phase 2 connectors + browser sessions.
 * Individual portal failures do not abort other portals (graceful failover).
 */
export async function searchPortalsInParallel(input: {
  workspaceId: string;
  criteria: ResearchPlanCriteria;
  portals: string[];
  onPortalDone?: (
    done: number,
    total: number,
    portal: string,
    outcome: PortalSearchOutcome,
  ) => void | Promise<void>;
}): Promise<{
  listings: ResearchListing[];
  outcomes: PortalSearchOutcome[];
}> {
  const portals = input.portals.length
    ? input.portals
    : ['housing', 'magicbricks', '99acres', 'nobroker', 'squareyards'];

  let done = 0;
  const outcomes = await Promise.all(
    portals.map(async (portal) => {
      let outcome: PortalSearchOutcome;
      try {
        const connector = requirePortalConnector(portal);
        const validation = await connector.validateSession(input.workspaceId);
        if (!validation.ok) {
          outcome = {
            portal,
            ok: false,
            listings: [] as ResearchListing[],
            message: validation.message || `Session ${validation.status}`,
          };
        } else {
          const response = await connector.executeSearch({
            workspaceId: input.workspaceId,
            criteria: input.criteria,
            sessionId: validation.sessionId,
            skipValidation: true,
          });
          outcome = {
            portal,
            ok: response.ok,
            listings: response.listings || [],
            message: response.message,
          };
        }
      } catch (error) {
        outcome = {
          portal,
          ok: false,
          listings: [] as ResearchListing[],
          message: error instanceof Error ? error.message : String(error),
        };
      }
      done += 1;
      await input.onPortalDone?.(done, portals.length, portal, outcome);
      return outcome;
    }),
  );

  return {
    listings: outcomes.flatMap((o) => o.listings),
    outcomes,
  };
}
