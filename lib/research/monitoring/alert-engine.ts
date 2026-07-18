import type { KgChange, KgProperty } from '@/lib/research/graph/types';
import { createNotification } from '@/lib/research/monitoring/notification-store';
import type {
  AlertCategory,
  AlertSeverity,
  ResearchWatch,
} from '@/lib/research/monitoring/types';

function severityForPriceDrop(pct: number): AlertSeverity {
  if (pct >= 10) return 'high';
  if (pct >= 5) return 'medium';
  return 'low';
}

function kgLinks(property?: KgProperty) {
  if (!property) return {};
  return {
    knowledgeGraph: {
      propertyHref: `/research/knowledge?entity=property&id=${property.id}`,
      projectHref: property.projectId
        ? `/research/knowledge?entity=project&id=${property.projectId}`
        : undefined,
      brokerHref: property.brokerId
        ? `/research/knowledge?entity=broker&id=${property.brokerId}`
        : undefined,
      localityHref: property.localityId
        ? `/research/knowledge?entity=locality&id=${property.localityId}`
        : undefined,
    },
  };
}

/**
 * Create evidence-backed notifications from KG changes + crawl deltas.
 */
export async function generateAlertsFromChanges(input: {
  watch: ResearchWatch;
  jobId: string;
  changes: KgChange[];
  propertiesById: Map<string, KgProperty>;
  newCount: number;
  removedCount: number;
  knownBefore: number;
  knownAfter: number;
}): Promise<number> {
  let created = 0;
  const { watch, jobId, changes, propertiesById } = input;

  if (input.newCount > 0) {
    await createNotification({
      workspaceId: watch.workspaceId,
      watchId: watch.id,
      jobId,
      category: 'new_listing',
      severity: input.newCount >= 5 ? 'high' : 'medium',
      title: `${input.newCount} new listing(s) match “${watch.name}”`,
      body: `Incremental crawl found ${input.newCount} new listing(s) for this watch.`,
      projectId: watch.scope === 'project' ? watch.targetId : undefined,
      evidence: {
        newCount: input.newCount,
        watchId: watch.id,
        source: 'incremental_crawl',
        timeline: [{ at: new Date().toISOString(), event: 'new_listings_detected' }],
        supportingObservations: { jobId, watchId: watch.id },
      },
    });
    created += 1;
  }

  if (input.removedCount > 0) {
    await createNotification({
      workspaceId: watch.workspaceId,
      watchId: watch.id,
      jobId,
      category: 'listing_removed',
      severity: 'medium',
      title: `${input.removedCount} listing(s) removed for “${watch.name}”`,
      body: `Listings previously seen were not present in the latest portal pass.`,
      evidence: {
        removedCount: input.removedCount,
        watchId: watch.id,
        source: 'incremental_crawl',
        timeline: [{ at: new Date().toISOString(), event: 'listings_absent_in_crawl' }],
      },
    });
    created += 1;
  }

  const inventoryDelta = input.knownAfter - input.knownBefore;
  if (inventoryDelta !== 0 && input.knownBefore > 0) {
    const up = inventoryDelta > 0;
    const pct = Math.round((Math.abs(inventoryDelta) / input.knownBefore) * 1000) / 10;
    await createNotification({
      workspaceId: watch.workspaceId,
      watchId: watch.id,
      jobId,
      category: up ? 'inventory_up' : 'inventory_down',
      severity: Math.abs(inventoryDelta) >= 5 ? 'high' : 'low',
      title: up
        ? `Inventory increased for “${watch.name}”`
        : `Inventory decreased for “${watch.name}”`,
      body: `Active tracked inventory moved from ${input.knownBefore} to ${input.knownAfter} (${inventoryDelta > 0 ? '+' : ''}${inventoryDelta}, ${pct}%).`,
      evidence: {
        knownBefore: input.knownBefore,
        knownAfter: input.knownAfter,
        delta: inventoryDelta,
        deltaPct: pct,
        timeline: [
          { at: new Date().toISOString(), event: up ? 'inventory_spike' : 'inventory_decline' },
        ],
      },
    });
    created += 1;

    if (up && pct >= 15 && watch.scope === 'project') {
      await createNotification({
        workspaceId: watch.workspaceId,
        watchId: watch.id,
        jobId,
        category: 'project_momentum',
        severity: 'high',
        title: `Project momentum increasing — “${watch.name}”`,
        body: `Inventory rose ~${pct}% in this monitoring window.`,
        projectId: watch.targetId,
        evidence: {
          deltaPct: pct,
          knownBefore: input.knownBefore,
          knownAfter: input.knownAfter,
          timeline: [{ at: new Date().toISOString(), event: 'project_momentum' }],
        },
      });
      created += 1;
    }

    if (up && watch.scope === 'builder') {
      await createNotification({
        workspaceId: watch.workspaceId,
        watchId: watch.id,
        jobId,
        category: 'builder_launch',
        severity: 'medium',
        title: `Builder inventory expansion — “${watch.name}”`,
        body: `New inventory detected for this builder watch (+${inventoryDelta}).`,
        builderId: watch.targetId,
        evidence: {
          delta: inventoryDelta,
          timeline: [{ at: new Date().toISOString(), event: 'builder_inventory_expansion' }],
        },
      });
      created += 1;
    }
  }

  for (const change of changes) {
    const property = propertiesById.get(change.propertyId);
    const mapped = mapChangeToAlert(change);
    if (!mapped) continue;

    let body = mapped.body;
    if (change.type === 'price_dropped' || change.type === 'price_increased') {
      const from = Number(change.fromValue);
      const to = Number(change.toValue);
      if (Number.isFinite(from) && from > 0 && Number.isFinite(to)) {
        const pct = Math.round((Math.abs(to - from) / from) * 1000) / 10;
        body = `Price moved from ₹${from.toLocaleString('en-IN')} to ₹${to.toLocaleString('en-IN')} (${pct}%).`;
        if (change.type === 'price_dropped') {
          if (pct < 5) continue; // only alert meaningful drops
          mapped.severity = severityForPriceDrop(pct);
          mapped.title = `Price dropped ${pct}%${property?.title ? `: ${property.title}` : ''}`;
        }
      }
    }

    await createNotification({
      workspaceId: watch.workspaceId,
      watchId: watch.id,
      jobId,
      category: mapped.category,
      severity: mapped.severity,
      title: mapped.title,
      body,
      propertyId: change.propertyId,
      projectId: property?.projectId,
      brokerId: property?.brokerId,
      localityId: property?.localityId,
      evidence: {
        changeId: change.id,
        changeType: change.type,
        fromValue: change.fromValue,
        toValue: change.toValue,
        detectedAt: change.detectedAt,
        portal: change.portal,
        changeEvidence: change.evidence,
        confidence: change.evidence?.confidence ?? 0.8,
        timeline: [
          { at: change.detectedAt, event: change.type, propertyId: change.propertyId },
        ],
        supportingObservations: change.evidence,
        ...kgLinks(property),
      },
    });
    created += 1;
  }

  for (const property of propertiesById.values()) {
    if (property.status === 'active' && property.daysOnMarket >= 120) {
      await createNotification({
        workspaceId: watch.workspaceId,
        watchId: watch.id,
        jobId,
        category: 'stale_listing',
        severity: 'medium',
        title: `Listing active ${property.daysOnMarket} days`,
        body: `“${property.title || property.id.slice(0, 8)}” has been tracked as active for ${property.daysOnMarket} days.`,
        propertyId: property.id,
        projectId: property.projectId,
        evidence: {
          daysOnMarket: property.daysOnMarket,
          firstSeenAt: property.firstSeenAt,
          lastSeenAt: property.lastSeenAt,
          timeline: [
            { at: property.firstSeenAt, event: 'first_seen' },
            { at: property.lastSeenAt, event: 'last_seen' },
          ],
          ...kgLinks(property),
        },
      });
      created += 1;
    }
  }

  return created;
}

function mapChangeToAlert(change: KgChange): {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  body: string;
} | null {
  switch (change.type) {
    case 'price_dropped':
      return {
        category: 'price_drop',
        severity: 'medium',
        title: 'Price drop detected',
        body: 'A monitored property price decreased.',
      };
    case 'price_increased':
      return {
        category: 'price_increase',
        severity: 'low',
        title: 'Price increase detected',
        body: 'A monitored property price increased.',
      };
    case 'broker_changed':
      return {
        category: 'broker_change',
        severity: 'medium',
        title: 'Broker changed',
        body: 'Broker association changed on a monitored property.',
      };
    case 'listing_reappeared':
      return {
        category: 'relisted',
        severity: 'medium',
        title: 'Property re-listed',
        body: 'A previously removed listing reappeared.',
      };
    case 'listing_removed':
      return {
        category: 'listing_removed',
        severity: 'medium',
        title: 'Listing removed',
        body: 'A monitored listing was marked removed.',
      };
    case 'portal_added':
      return {
        category: 'portal_added',
        severity: 'info',
        title: 'New portal listing',
        body: 'Property appeared on an additional portal.',
      };
    case 'portal_removed':
      return {
        category: 'portal_removed',
        severity: 'low',
        title: 'Portal listing removed',
        body: 'Property disappeared from a portal.',
      };
    case 'amenities_updated':
      return {
        category: 'amenities_changed',
        severity: 'info',
        title: 'Amenities updated',
        body: 'Amenities changed on a monitored listing.',
      };
    case 'description_changed':
      return {
        category: 'description_changed',
        severity: 'info',
        title: 'Description updated',
        body: 'Listing description changed.',
      };
    case 'images_changed':
      return {
        category: 'images_changed',
        severity: 'info',
        title: 'Images updated',
        body: 'Listing media fingerprints changed.',
      };
    case 'availability_changed':
      return {
        category: 'availability_changed',
        severity: 'medium',
        title: 'Availability updated',
        body: 'Availability status changed on a monitored listing.',
      };
    default:
      return null;
  }
}
