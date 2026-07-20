import { v4 as uuidv4 } from 'uuid';
import { getPortalMeta } from '@/lib/research/browser/config';
import { registerAlias, resolveCanonicalName } from '@/lib/research/graph/aliases';
import { isConfidentMatch, scoreIdentityMatch } from '@/lib/research/graph/confidence';
import {
  findPropertyByFingerprint,
  saveProperty,
  upsertBroker,
  upsertBuilding,
  upsertLocality,
  upsertPortalNode,
  upsertProject,
  upsertTower,
} from '@/lib/research/graph/entity-store';
import { buildIdentityFingerprints, listingAttributes } from '@/lib/research/graph/identity';
import {
  extractImageUrlsFromListing,
  fingerprintImageUrls,
} from '@/lib/research/graph/image-fingerprint';
import { RESEARCH_COLLECTIONS } from '@/lib/research/collections';
import { ensureKnowledgeGraphIndexes } from '@/lib/research/graph/indexes';
import type {
  KgChange,
  KgEdge,
  KgEnrichmentResult,
  KgListingNode,
  KgObservation,
  KgProperty,
  KgTimelineEvent,
} from '@/lib/research/graph/types';
import { ensureResearchIndexes, getResearchDatabase } from '@/lib/research/store';
import type { ResearchScoredListing } from '@/lib/research/types';
import { recomputeBrokerStats } from '@/lib/research/graph/broker-intel';
import { recomputeProjectStats } from '@/lib/research/graph/project-intel';
import { recomputeLocalityStats } from '@/lib/research/graph/locality-intel';

function daysBetween(a: string, b: string): number {
  const ms = Math.abs(new Date(b).getTime() - new Date(a).getTime());
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function extractAmenities(listing: ResearchScoredListing): string[] {
  const text = `${listing.rawText || ''} ${listing.title || ''}`.toLowerCase();
  const catalog = [
    'parking',
    'gym',
    'pool',
    'clubhouse',
    'garden',
    'security',
    'lift',
    'power backup',
    'servant',
    'balcony',
  ];
  return catalog.filter((a) => text.includes(a));
}

function extractAvailability(listing: ResearchScoredListing): string | undefined {
  const text = `${listing.rawText || ''}`.toLowerCase();
  if (/immediate|ready to move|available now/.test(text)) return 'immediate';
  if (/under construction/.test(text)) return 'under_construction';
  if (/available/.test(text)) return 'available';
  return undefined;
}

async function upsertEdge(
  input: Omit<KgEdge, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
) {
  const db = await getResearchDatabase();
  const now = new Date().toISOString();
  const existing = await db.collection<KgEdge>(RESEARCH_COLLECTIONS.kgEdges).findOne({
    workspaceId: input.workspaceId,
    type: input.type,
    fromId: input.fromId,
    toId: input.toId,
  });
  if (existing) {
    await db.collection(RESEARCH_COLLECTIONS.kgEdges).updateOne(
      { id: existing.id },
      {
        $set: {
          evidence: input.evidence,
          confidenceScore: input.confidenceScore,
          confidenceReason: input.confidenceReason,
          matchingFactors: input.matchingFactors,
          updatedAt: now,
        },
      },
    );
    return existing.id;
  }
  const edge: KgEdge = {
    id: uuidv4(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  await db.collection(RESEARCH_COLLECTIONS.kgEdges).insertOne(edge);
  return edge.id;
}

async function appendObservation(obs: KgObservation) {
  const db = await getResearchDatabase();
  await db.collection(RESEARCH_COLLECTIONS.kgObservations).insertOne(obs);
}

async function appendChange(change: KgChange) {
  const db = await getResearchDatabase();
  await db.collection(RESEARCH_COLLECTIONS.kgChanges).insertOne(change);
}

async function appendTimeline(event: KgTimelineEvent) {
  const db = await getResearchDatabase();
  await db.collection(RESEARCH_COLLECTIONS.kgTimeline).insertOne(event);
}

/**
 * Resolve identities, append observations, detect changes, update graph entities.
 * Called after Phase 3 research completes. Never fabricates data.
 */
export async function enrichKnowledgeGraph(input: {
  workspaceId: string;
  researchSessionId: string;
  runId?: string;
  listings: ResearchScoredListing[];
}): Promise<KgEnrichmentResult> {
  const db = await getResearchDatabase();
  await ensureResearchIndexes(db);
  await ensureKnowledgeGraphIndexes(db);

  const result: KgEnrichmentResult = {
    propertiesUpserted: 0,
    observationsAppended: 0,
    changesDetected: 0,
    brokersUpdated: 0,
    projectsUpdated: 0,
    localitiesUpdated: 0,
  };

  const touchedProjectIds = new Set<string>();
  const touchedBrokerIds = new Set<string>();
  const touchedLocalityIds = new Set<string>();
  const now = new Date().toISOString();

  for (const listing of input.listings) {
    const identity = buildIdentityFingerprints(listing);
    const attrs = listingAttributes(listing);
    const imageUrls = extractImageUrlsFromListing(listing);
    const imageFingerprints = fingerprintImageUrls(imageUrls);
    const amenities = extractAmenities(listing);
    const availability = extractAvailability(listing);

    let property = await findPropertyByFingerprint(
      input.workspaceId,
      identity.fingerprint,
      identity.altFingerprints,
    );

    let matchConfidence = property
      ? scoreIdentityMatch(listing, property, imageFingerprints)
      : { score: 100, reason: 'New canonical property', matchingFactors: ['New identity'] };

    // Reject weak fingerprint collisions — create a new property instead of merging
    if (property && !isConfidentMatch(matchConfidence) && matchConfidence.score < 70) {
      property = null;
      matchConfidence = {
        score: 100,
        reason: 'New canonical property (weak prior match rejected)',
        matchingFactors: ['New identity'],
      };
    }

    const projectNameRaw = listing.projectName || attrs.projectName;
    const projectName = projectNameRaw
      ? await resolveCanonicalName(input.workspaceId, 'project', projectNameRaw)
      : undefined;
    if (projectNameRaw && projectName && projectNameRaw !== projectName) {
      await registerAlias({
        workspaceId: input.workspaceId,
        entityType: 'project',
        canonicalName: projectName,
        alias: projectNameRaw,
      }).catch(() => undefined);
    }
    const localityName = listing.locality
      ? await resolveCanonicalName(input.workspaceId, 'locality', listing.locality)
      : undefined;
    const brokerName = attrs.brokerName
      ? await resolveCanonicalName(input.workspaceId, 'broker', attrs.brokerName)
      : undefined;

    const project = projectName
      ? await upsertProject(input.workspaceId, projectName, localityName)
      : null;
    if (project) touchedProjectIds.add(project.id);

    const locality = localityName
      ? await upsertLocality(input.workspaceId, localityName)
      : null;
    if (locality) touchedLocalityIds.add(locality.id);

    const broker = brokerName
      ? await upsertBroker(input.workspaceId, brokerName)
      : null;
    if (broker) touchedBrokerIds.add(broker.id);

    const building =
      projectName && attrs.tower
        ? await upsertBuilding(input.workspaceId, `${projectName} ${attrs.tower}`, project?.id)
        : null;
    const tower = attrs.tower
      ? await upsertTower(input.workspaceId, attrs.tower, project?.id, building?.id)
      : null;

    const portals = listing.portalRefs?.length
      ? listing.portalRefs
      : [{ portal: listing.portal, url: listing.url, listingId: listing.id }];

    for (const ref of portals) {
      const meta = getPortalMeta(ref.portal);
      await upsertPortalNode(
        input.workspaceId,
        ref.portal,
        meta?.displayName || ref.portal,
      );
    }

    const changes: KgChange[] = [];
    const isNew = !property;

    if (!property) {
      property = {
        id: uuidv4(),
        workspaceId: input.workspaceId,
        identity,
        projectId: project?.id,
        buildingId: building?.id,
        towerId: tower?.id,
        localityId: locality?.id,
        brokerId: broker?.id,
        title: listing.title,
        projectName: projectName || project?.name,
        buildingName: building?.name,
        tower: attrs.tower,
        wing: attrs.wing,
        unit: attrs.unit,
        floor: attrs.floor,
        facing: attrs.facing || listing.facing,
        configuration: listing.configuration,
        bhk: listing.bhk,
        carpetArea: attrs.carpetArea,
        rent: listing.rent,
        salePrice: listing.salePrice,
        furnishing: listing.furnishing,
        listedBy: listing.listedBy || 'unknown',
        localityName: localityName || locality?.name,
        status: 'active',
        portalKeys: portals.map((p) => p.portal),
        portalUrls: portals.map((p) => p.url).filter(Boolean) as string[],
        imageHashes: attrs.imageHashes,
        imageFingerprints,
        externalAliases: listing.url ? [listing.url] : [],
        amenities,
        availability,
        identityConfidence: matchConfidence,
        firstSeenAt: now,
        lastSeenAt: now,
        daysOnMarket: 0,
        observationCount: 0,
        listingFrequency: 0,
        priceHistory: [],
        brokerHistory: [],
        portalHistory: [],
        currentResearchSessionIds: [input.researchSessionId],
        createdAt: now,
        updatedAt: now,
      };
      changes.push({
        id: uuidv4(),
        workspaceId: input.workspaceId,
        propertyId: property.id,
        type: 'first_seen',
        toValue: { title: listing.title, rent: listing.rent },
        researchSessionId: input.researchSessionId,
        evidence: { fingerprint: identity.fingerprint, listingId: listing.id },
        detectedAt: now,
        createdAt: now,
      });
      await appendTimeline({
        id: uuidv4(),
        workspaceId: input.workspaceId,
        propertyId: property.id,
        type: 'created',
        label: 'Property created in knowledge graph',
        details: { fingerprint: identity.fingerprint },
        at: now,
        createdAt: now,
      });
      await appendTimeline({
        id: uuidv4(),
        workspaceId: input.workspaceId,
        propertyId: property.id,
        type: 'first_seen',
        label: 'First seen from portal research',
        details: { portals: portals.map((p) => p.portal) },
        at: now,
        createdAt: now,
      });
    } else {
      // Change detection against previous state
      const prevRent = property.rent;
      const nextRent = listing.rent ?? property.rent;
      if (prevRent != null && listing.rent != null && listing.rent !== prevRent) {
        const type = listing.rent < prevRent ? 'price_dropped' : 'price_increased';
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type,
          fromValue: prevRent,
          toValue: listing.rent,
          portal: listing.portal,
          researchSessionId: input.researchSessionId,
          evidence: { listingId: listing.id },
          detectedAt: now,
          createdAt: now,
        });
        await appendTimeline({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: type === 'price_dropped' ? 'price_reduced' : 'price_increased',
          label: `Price ${type === 'price_dropped' ? 'reduced' : 'increased'} from ₹${prevRent} to ₹${listing.rent}`,
          details: { from: prevRent, to: listing.rent },
          at: now,
          createdAt: now,
        });
      }

      if (broker && property.brokerId && broker.id !== property.brokerId) {
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'broker_changed',
          fromValue: property.brokerId,
          toValue: broker.id,
          researchSessionId: input.researchSessionId,
          evidence: { brokerName: broker.name },
          detectedAt: now,
          createdAt: now,
        });
        await appendTimeline({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'broker_changed',
          label: `Broker changed to ${broker.name}`,
          details: { brokerId: broker.id },
          at: now,
          createdAt: now,
        });
      }

      if (property.status === 'removed') {
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'listing_reappeared',
          fromValue: 'removed',
          toValue: 'active',
          researchSessionId: input.researchSessionId,
          evidence: { listingId: listing.id },
          detectedAt: now,
          createdAt: now,
        });
        await appendTimeline({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'relisted',
          label: 'Listing reappeared',
          at: now,
          createdAt: now,
        });
      }

      const prevDesc = property.title || '';
      if (listing.title && prevDesc && listing.title !== prevDesc) {
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'description_changed',
          fromValue: prevDesc,
          toValue: listing.title,
          researchSessionId: input.researchSessionId,
          evidence: {},
          detectedAt: now,
          createdAt: now,
        });
      }

      for (const ref of portals) {
        if (!property.portalKeys.includes(ref.portal)) {
          changes.push({
            id: uuidv4(),
            workspaceId: input.workspaceId,
            propertyId: property.id,
            type: 'portal_added',
            toValue: ref.portal,
            portal: ref.portal,
            researchSessionId: input.researchSessionId,
            evidence: { url: ref.url },
            detectedAt: now,
            createdAt: now,
          });
          await appendTimeline({
            id: uuidv4(),
            workspaceId: input.workspaceId,
            propertyId: property.id,
            type: 'portal_added',
            label: `Also seen on ${ref.portal}`,
            details: { url: ref.url },
            at: now,
            createdAt: now,
          });
        }
      }

      const prevImages = property.imageFingerprints || [];
      const newImageSet = new Set(imageFingerprints);
      const imagesChanged =
        imageFingerprints.some((fp) => !prevImages.includes(fp))
        || prevImages.some((fp) => !newImageSet.has(fp) && imageFingerprints.length > 0);
      if (imagesChanged && imageFingerprints.length) {
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'images_changed',
          fromValue: prevImages,
          toValue: imageFingerprints,
          researchSessionId: input.researchSessionId,
          evidence: { imageUrls },
          detectedAt: now,
          createdAt: now,
        });
        await appendTimeline({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'latest_observation',
          label: 'Images updated',
          details: { fingerprints: imageFingerprints.slice(0, 5) },
          at: now,
          createdAt: now,
        });
      }

      const prevAmenities = property.amenities || [];
      if (
        amenities.length
        && amenities.some((a) => !prevAmenities.includes(a))
      ) {
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'amenities_updated',
          fromValue: prevAmenities,
          toValue: amenities,
          researchSessionId: input.researchSessionId,
          evidence: {},
          detectedAt: now,
          createdAt: now,
        });
      }

      if (
        availability
        && property.availability
        && availability !== property.availability
      ) {
        changes.push({
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          type: 'availability_changed',
          fromValue: property.availability,
          toValue: availability,
          researchSessionId: input.researchSessionId,
          evidence: {},
          detectedAt: now,
          createdAt: now,
        });
      }

      property = {
        ...property,
        identity: {
          fingerprint: property.identity.fingerprint,
          altFingerprints: Array.from(
            new Set([
              ...property.identity.altFingerprints,
              ...identity.altFingerprints,
              identity.fingerprint,
            ]),
          ).filter((f) => f !== property!.identity.fingerprint),
        },
        title: listing.title || property.title,
        projectId: project?.id || property.projectId,
        buildingId: building?.id || property.buildingId,
        towerId: tower?.id || property.towerId,
        localityId: locality?.id || property.localityId,
        brokerId: broker?.id || property.brokerId,
        projectName: projectName || property.projectName,
        tower: attrs.tower || property.tower,
        wing: attrs.wing || property.wing,
        unit: attrs.unit || property.unit,
        floor: attrs.floor || property.floor,
        facing: attrs.facing || listing.facing || property.facing,
        configuration: listing.configuration || property.configuration,
        bhk: listing.bhk ?? property.bhk,
        carpetArea: attrs.carpetArea ?? property.carpetArea,
        rent: listing.rent ?? property.rent,
        salePrice: listing.salePrice ?? property.salePrice,
        furnishing: listing.furnishing || property.furnishing,
        listedBy:
          listing.listedBy && listing.listedBy !== 'unknown'
            ? listing.listedBy
            : property.listedBy || listing.listedBy || 'unknown',
        localityName: localityName || locality?.name || property.localityName,
        status: 'active',
        portalKeys: Array.from(new Set([...property.portalKeys, ...portals.map((p) => p.portal)])),
        portalUrls: Array.from(
          new Set([
            ...property.portalUrls,
            ...portals.map((p) => p.url).filter(Boolean) as string[],
          ]),
        ),
        imageHashes: Array.from(new Set([...property.imageHashes, ...attrs.imageHashes])),
        imageFingerprints: Array.from(
          new Set([...(property.imageFingerprints || []), ...imageFingerprints]),
        ),
        externalAliases: Array.from(
          new Set([
            ...(property.externalAliases || []),
            ...(listing.url ? [listing.url] : []),
            ...(listing.id ? [listing.id] : []),
          ]),
        ),
        amenities: Array.from(new Set([...(property.amenities || []), ...amenities])),
        availability: availability || property.availability,
        identityConfidence: matchConfidence,
        lastSeenAt: now,
        daysOnMarket: daysBetween(property.firstSeenAt, now),
        currentResearchSessionIds: Array.from(
          new Set([...property.currentResearchSessionIds, input.researchSessionId]),
        ),
        updatedAt: now,
        priceHistory: property.priceHistory,
        brokerHistory: property.brokerHistory,
        portalHistory: property.portalHistory,
      };
      void nextRent;
    }

    // Append history (never overwrite)
    if (listing.rent != null || listing.salePrice != null) {
      property.priceHistory = [
        ...property.priceHistory,
        {
          at: now,
          rent: listing.rent,
          salePrice: listing.salePrice,
          portal: listing.portal,
        },
      ].slice(-200);
    }
    if (broker) {
      property.brokerHistory = [
        ...property.brokerHistory,
        { at: now, brokerId: broker.id, brokerName: broker.name },
      ].slice(-100);
    }
    for (const ref of portals) {
      property.portalHistory = [
        ...property.portalHistory,
        { at: now, portal: ref.portal, url: ref.url },
      ].slice(-200);
    }

    property.observationCount += 1;
    property.listingFrequency = property.observationCount;
    property.daysOnMarket = daysBetween(property.firstSeenAt, now);

    await saveProperty(property);
    result.propertiesUpserted += 1;

    for (const change of changes) {
      await appendChange(change);
      result.changesDetected += 1;
    }

    // Listing nodes + observations per portal ref
    for (const ref of portals) {
      const listingCol = db.collection<KgListingNode>(RESEARCH_COLLECTIONS.kgListings);
      const existingListing = await listingCol.findOne({
        workspaceId: input.workspaceId,
        propertyId: property.id,
        portal: ref.portal,
        externalUrl: ref.url,
      });
      let listingNode: KgListingNode;
      if (!existingListing) {
        listingNode = {
          id: uuidv4(),
          workspaceId: input.workspaceId,
          propertyId: property.id,
          portal: ref.portal,
          externalUrl: ref.url,
          externalListingId: ref.listingId,
          firstSeenAt: now,
          lastSeenAt: now,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await listingCol.insertOne(listingNode);
      } else {
        listingNode = {
          ...existingListing,
          lastSeenAt: now,
          status: 'active',
          updatedAt: now,
        };
        await listingCol.updateOne(
          { id: listingNode.id },
          { $set: { lastSeenAt: now, status: 'active', updatedAt: now } },
        );
      }

      const obs: KgObservation = {
        id: uuidv4(),
        workspaceId: input.workspaceId,
        propertyId: property.id,
        listingId: listingNode.id,
        researchSessionId: input.researchSessionId,
        runId: input.runId,
        portal: ref.portal,
        url: ref.url,
        title: listing.title,
        rent: listing.rent,
        salePrice: listing.salePrice,
        brokerName: brokerName || attrs.brokerName,
        brokerId: broker?.id,
        furnishing: listing.furnishing,
        facing: attrs.facing || listing.facing,
        availability,
        amenities,
        descriptionSnippet: attrs.descriptionSnippet,
        imageHashes: attrs.imageHashes,
        imageFingerprints,
        rawListingId: listing.id,
        rawData: {
          listingId: listing.id,
          portalRefs: listing.portalRefs,
          extracted: listing.extracted || {},
          score: listing.relevanceScore,
        },
        observedAt: now,
        createdAt: now,
      };
      await appendObservation(obs);
      result.observationsAppended += 1;

      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'listing_property',
        fromId: listingNode.id,
        toId: property.id,
        confidenceScore: matchConfidence.score,
        confidenceReason: matchConfidence.reason,
        matchingFactors: matchConfidence.matchingFactors,
        evidence: { portal: ref.portal, url: ref.url },
      });
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'research_listing',
        fromId: input.researchSessionId,
        toId: listingNode.id,
        evidence: { sessionId: input.researchSessionId },
      });
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'observation_property',
        fromId: obs.id,
        toId: property.id,
        confidenceScore: matchConfidence.score,
        confidenceReason: matchConfidence.reason,
        matchingFactors: matchConfidence.matchingFactors,
        evidence: { portal: ref.portal },
      });
      if (broker) {
        await upsertEdge({
          workspaceId: input.workspaceId,
          type: 'observation_broker',
          fromId: obs.id,
          toId: broker.id,
          confidenceScore: brokerName ? 90 : 60,
          confidenceReason: brokerName
            ? 'Broker name extracted from listing text'
            : 'Broker weakly associated',
          matchingFactors: brokerName ? ['Broker'] : [],
          evidence: { brokerName },
        });
      }
      const portalNodeForObs = await upsertPortalNode(
        input.workspaceId,
        ref.portal,
        getPortalMeta(ref.portal)?.displayName || ref.portal,
      );
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'observation_portal',
        fromId: obs.id,
        toId: portalNodeForObs.id,
        confidenceScore: 100,
        confidenceReason: 'Observation created from portal crawl',
        matchingFactors: ['Portal'],
        evidence: { portal: ref.portal, url: ref.url },
      });
    }

    await upsertEdge({
      workspaceId: input.workspaceId,
      type: 'research_property',
      fromId: input.researchSessionId,
      toId: property.id,
      confidenceScore: matchConfidence.score,
      confidenceReason: matchConfidence.reason,
      matchingFactors: matchConfidence.matchingFactors,
      evidence: { isNew },
    });
    if (project) {
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'property_project',
        fromId: property.id,
        toId: project.id,
        confidenceScore: matchConfidence.matchingFactors.includes('Project') ? 95 : 80,
        confidenceReason: matchConfidence.reason,
        matchingFactors: matchConfidence.matchingFactors.filter((f) =>
          ['Project', 'Tower', 'Unit'].includes(f),
        ),
        evidence: { projectName: project.name },
      });
      if (locality) {
        await upsertEdge({
          workspaceId: input.workspaceId,
          type: 'project_locality',
          fromId: project.id,
          toId: locality.id,
          evidence: { localityName: locality.name },
        });
      }
    }
    if (building) {
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'property_building',
        fromId: property.id,
        toId: building.id,
        evidence: {},
      });
    }
    if (tower) {
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'property_tower',
        fromId: property.id,
        toId: tower.id,
        evidence: {},
      });
    }
    if (broker) {
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'property_broker',
        fromId: property.id,
        toId: broker.id,
        evidence: { brokerName: broker.name },
      });
      for (const ref of portals) {
        const portalNode = await upsertPortalNode(
          input.workspaceId,
          ref.portal,
          getPortalMeta(ref.portal)?.displayName || ref.portal,
        );
        await upsertEdge({
          workspaceId: input.workspaceId,
          type: 'broker_portal',
          fromId: broker.id,
          toId: portalNode.id,
          evidence: {},
        });
      }
    }
    if (locality) {
      await upsertEdge({
        workspaceId: input.workspaceId,
        type: 'property_locality',
        fromId: property.id,
        toId: locality.id,
        evidence: {},
      });
    }

    await appendTimeline({
      id: uuidv4(),
      workspaceId: input.workspaceId,
      propertyId: property.id,
      type: 'latest_observation',
      label: 'Latest observation from research',
      details: {
        researchSessionId: input.researchSessionId,
        portals: portals.map((p) => p.portal),
        rent: listing.rent,
      },
      at: now,
      createdAt: now,
    });
    await appendTimeline({
      id: uuidv4(),
      workspaceId: input.workspaceId,
      propertyId: property.id,
      type: 'research_session',
      label: 'Included in research session',
      details: { researchSessionId: input.researchSessionId },
      at: now,
      createdAt: now,
    });
  }

  for (const projectId of touchedProjectIds) {
    await recomputeProjectStats(input.workspaceId, projectId);
    result.projectsUpdated += 1;
  }
  for (const brokerId of touchedBrokerIds) {
    await recomputeBrokerStats(input.workspaceId, brokerId);
    result.brokersUpdated += 1;
  }
  for (const localityId of touchedLocalityIds) {
    await recomputeLocalityStats(input.workspaceId, localityId);
    result.localitiesUpdated += 1;
  }

  return result;
}
