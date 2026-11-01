/**
 * Broker share cards and the market match rules.
 * Run: yarn test:market-board
 */
import assert from 'node:assert/strict';
import type { OpsProspect } from '../lib/ops/calls/types';
import type { OpsDemandRecord } from '../lib/ops/demand/types';
import type { NormalizedOpsLead } from '../lib/ops/leads/types';
import {
  demandToRequirement,
  prospectToFlat,
  prospectToRequirement,
  supplyToFlat,
} from '../lib/ops/market/adapt';
import { buildMarketOverview } from '../lib/ops/market/match';
import { floorRangeLabel, parseBudgetRange, parseInrAmount } from '../lib/ops/market/normalize';
import { buildBrokerShareCard } from '../lib/ops/market/share-card';
import type { OpsSupplyRecord } from '../lib/ops/supply/types';

const SECRET_RENT = '87500';
const SECRET_RENT_GROUPED = '87,500';
const SECRET_PRICE = '2.35';
const SECRET_PRICE_DIGITS = '23500000';
const SECRET_PRICE_GROUPED = '2,35,00,000';
const SECRET_DEPOSIT = '300000';
const SECRET_UNIT = 'B-1804';
const SECRET_UNIT_DIGITS = '1804';
const SECRET_FLOOR = '18';
const SECRET_OWNER = 'Mehul Shah';
const SECRET_PHONE = '9876501234';
const SECRET_PHONE_SPACED = '98765 01234';

function supply(partial: Partial<OpsSupplyRecord> & Pick<OpsSupplyRecord, 'id'>): OpsSupplyRecord {
  return {
    source: 'manual_inventory',
    priority: 'MEDIUM',
    status: 'AVAILABLE',
    readyForMatching: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function demand(
  partial: Partial<OpsDemandRecord> & Pick<OpsDemandRecord, 'sourceId'>,
): OpsDemandRecord {
  return {
    id: partial.sourceId,
    source: 'housing_com',
    status: 'QUALIFIED',
    priority: 'MEDIUM',
    qualification: {},
    qualificationPercent: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function lead(partial: Partial<NormalizedOpsLead> & Pick<NormalizedOpsLead, 'sourceId'>): NormalizedOpsLead {
  return {
    source: 'housing_com',
    sourceCollection: 'housing_com_leads',
    createdAt: '2026-01-01T00:00:00.000Z',
    category: 'rental',
    ...partial,
  };
}

const COMMERCIAL_TERMS = [
  'co-broking',
  'cobroking',
  'co broke',
  'co-broke',
  '50/50',
  '50 / 50',
  '50-50',
  'brokerage',
  'commission',
  'split',
  'payout',
  '2%',
  'percent',
];

function assertExcluded(blob: string, label: string) {
  const forbidden = [
    SECRET_RENT,
    SECRET_RENT_GROUPED,
    '₹',
    SECRET_PRICE,
    SECRET_PRICE_DIGITS,
    SECRET_PRICE_GROUPED,
    'crore',
    SECRET_DEPOSIT,
    SECRET_UNIT,
    SECRET_UNIT_DIGITS,
    `Floor ${SECRET_FLOOR}`,
    `floor ${SECRET_FLOOR}`,
    SECRET_FLOOR,
    SECRET_OWNER,
    'Mehul',
    'Shah',
    SECRET_PHONE,
    SECRET_PHONE_SPACED,
    '+91',
    'owner',
    'flat no',
    ...COMMERCIAL_TERMS,
  ];
  for (const token of forbidden) {
    assert.equal(
      blob.toLowerCase().includes(token.toLowerCase()),
      false,
      `${label} leaked "${token}"`,
    );
  }
}

function main() {
  const record = supply({
    id: 'flat-sheth',
    listingType: 'rent',
    project: 'Sheth 72 West',
    locality: 'Andheri West',
    building: 'Tower C',
    wing: 'C',
    flatNumber: SECRET_UNIT,
    configuration: '3 BHK',
    floor: SECRET_FLOOR,
    furnishedStatus: 'Fully furnished',
    expectedRent: `₹${SECRET_RENT_GROUPED}`,
    expectedDeposit: SECRET_DEPOSIT,
    expectedSalePrice: `${SECRET_PRICE} Cr`,
    ownerName: SECRET_OWNER,
    ownerMobile: `+91 ${SECRET_PHONE_SPACED}`,
    ownerEmail: 'mehul.shah@example.com',
    brokeragePercent: '2%',
  });

  const card = buildBrokerShareCard(record);
  assert.deepEqual(Object.keys(card).sort(), [
    'bhkLabel',
    'floorRange',
    'furnishingLabel',
    'lines',
    'place',
    'priceLine',
    'whatsAppText',
  ]);
  assert.equal(card.bhkLabel, '3 BHK');
  assert.equal(card.floorRange, 'Mid floor 15-25');
  assert.equal(card.furnishingLabel, 'Furnished');
  assert.equal(card.place, 'Sheth 72 West, Andheri West');
  assert.equal(card.priceLine, 'Call for price');
  assert.equal(card.whatsAppText, card.lines.join('\n'));
  assert.equal(card.lines.includes('Call for price'), true);
  assert.equal(card.lines.some((line) => /brok|commission|split|50\s*\/\s*50|payout/i.test(line)), false);
  assert.match(card.whatsAppText, /3 BHK/);
  assert.match(card.whatsAppText, /Mid floor 15-25/);
  assert.match(card.whatsAppText, /Furnished/);
  assert.match(card.whatsAppText, /Sheth 72 West, Andheri West/);
  assert.match(card.whatsAppText, /Call for price/);
  assert.doesNotMatch(card.whatsAppText, /co-?brok|50\s*\/\s*50|brokerage|commission|split|payout/i);
  assertExcluded(JSON.stringify(card), 'share card');

  const messyFloor = buildBrokerShareCard({
    ...record,
    floor: `Floor ${SECRET_FLOOR}, flat ${SECRET_UNIT}`,
  });
  assert.equal(messyFloor.floorRange, 'Mid floor 15-25');
  assertExcluded(messyFloor.whatsAppText, 'messy floor share text');

  assert.equal(floorRangeLabel('3'), 'Lower floor 1-7');
  assert.equal(floorRangeLabel('ground'), 'Ground floor');
  assert.equal(floorRangeLabel(SECRET_UNIT_DIGITS), 'Floor range on request');
  assert.equal(buildBrokerShareCard({ ...record, floor: SECRET_UNIT_DIGITS }).whatsAppText.includes(SECRET_UNIT_DIGITS), false);

  const phoneInProject = buildBrokerShareCard({
    configuration: '2 BHK',
    project: `Tower ${SECRET_PHONE}`,
    locality: 'Andheri West',
    floor: '12',
    furnishedStatus: 'Unfurnished',
  });
  assert.equal(phoneInProject.place.includes(SECRET_PHONE), false);
  assert.match(phoneInProject.place, /Andheri West/);

  const ownerProspect: OpsProspect = {
    id: 'prospect-owner',
    phone: SECRET_PHONE,
    alternatePhone: SECRET_PHONE_SPACED,
    name: SECRET_OWNER,
    prospectType: 'rental_owner',
    projectName: 'Sheth 72 West',
    location: 'Andheri West',
    unit: SECRET_UNIT,
    requirement: `3BHK furnished for rent floor ${SECRET_FLOOR} unit ${SECRET_UNIT} rent ${SECRET_RENT} ${SECRET_OWNER} ${SECRET_PHONE}`,
    source: 'manual',
    callStatus: 'INTERESTED',
    intent: 'rent',
    createdBy: 'ops',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const prospectFlat = prospectToFlat(ownerProspect);
  assert.ok(prospectFlat);
  assert.equal(prospectFlat.amount, 87500);
  assertExcluded(JSON.stringify(prospectFlat.share), 'prospect share card');
  assert.match(prospectFlat.share.whatsAppText, /Call for price/);
  assert.match(prospectFlat.share.whatsAppText, /Mid floor 15-25/);
  assert.equal(prospectFlat.internalRef.includes(SECRET_UNIT), true);

  const rent80 = parseBudgetRange({ budget: '80k-1L' });
  assert.equal(rent80.min, 80000);
  assert.equal(rent80.max, 100000);
  const ceiling = parseBudgetRange({ budget: '85000' });
  assert.equal(ceiling.max, 85000);
  assert.equal(parseInrAmount('1.8 Cr'), 18000000);
  assert.equal(parseInrAmount(`call ${SECRET_PHONE} rent ${SECRET_RENT}`), 87500);

  const matchingFlat = supplyToFlat(supply({
    id: 'match-flat',
    listingType: 'rent',
    project: 'Sheth 72 West',
    locality: 'Andheri West',
    configuration: '2 BHK',
    floor: '19',
    furnishedStatus: 'Furnished',
    expectedRent: '80000',
    flatNumber: 'A-1902',
    ownerName: 'Private Owner',
    ownerMobile: '9000000001',
  }));
  const cheapFlat = supplyToFlat(supply({
    id: 'cheap-flat',
    listingType: 'rent',
    project: 'Sheth 72 West',
    locality: 'Andheri West',
    configuration: '2 BHK',
    furnishedStatus: 'Furnished',
    expectedRent: '15000',
    status: 'AVAILABLE',
  }));
  const saleFlat = supplyToFlat(supply({
    id: 'sale-flat',
    listingType: 'sale',
    project: 'Sheth 72 West',
    configuration: '2 BHK',
    furnishedStatus: 'Furnished',
    expectedSalePrice: '1.8 Cr',
    status: 'AVAILABLE',
  }));
  const closedFlat = supplyToFlat(supply({
    id: 'closed-flat',
    listingType: 'rent',
    project: 'Sheth 72 West',
    configuration: '2 BHK',
    expectedRent: '80000',
    status: 'WITHDRAWN',
  }));
  assert.equal(closedFlat, null);
  assert.ok(matchingFlat && cheapFlat && saleFlat);

  const ranged = demandToRequirement(demand({
    sourceId: 'req-range',
    qualification: {
      rentBuy: 'rent',
      bhk: '2 BHK',
      budgetMin: '70k',
      budgetMax: '90k',
      furnishing: 'Furnished',
      preferredProject: 'Sheth 72 West',
      locality: 'Andheri West',
    },
  }), lead({ sourceId: 'req-range', name: 'Asha', projectName: 'Sheth 72 West', location: 'Andheri West' }));

  const lowBudget = demandToRequirement(demand({
    sourceId: 'req-low',
    qualification: {
      rentBuy: 'rent',
      bhk: '2 BHK',
      budget: '40000',
      furnishing: 'Furnished',
      preferredProject: 'Sheth 72 West',
    },
  }), lead({ sourceId: 'req-low', name: 'Low', projectName: 'Sheth 72 West' }));

  const otherBhk = demandToRequirement(demand({
    sourceId: 'req-3',
    qualification: {
      rentBuy: 'rent',
      bhk: '3 BHK',
      budget: '80000',
      furnishing: 'Furnished',
      preferredProject: 'Sheth 72 West',
    },
  }), lead({ sourceId: 'req-3', name: 'Three' }));

  const buyer = demandToRequirement(demand({
    sourceId: 'req-buy',
    qualification: {
      rentBuy: 'buy',
      bhk: '2 BHK',
      budgetMin: '1.5 Cr',
      budgetMax: '2 Cr',
      furnishing: 'Furnished',
      preferredProject: 'Sheth 72 West',
    },
  }), lead({ sourceId: 'req-buy', name: 'Buyer', category: 'general' }));

  const bare = demandToRequirement(demand({
    sourceId: 'req-bare',
    qualification: {
      rentBuy: 'rent',
      bhk: '2 BHK',
      budget: '80000',
      furnishing: 'Unfurnished',
      preferredProject: 'Runwal Forests',
    },
  }), lead({ sourceId: 'req-bare', name: 'Other project' }));

  const openFurnishing = demandToRequirement(demand({
    sourceId: 'req-open',
    qualification: {
      rentBuy: 'rent',
      bhk: '2 BHK',
      budget: '90000',
    },
  }), lead({ sourceId: 'req-open', name: 'Open', requirement: '2BHK rent' }));

  const lost = demandToRequirement(demand({
    sourceId: 'req-lost',
    status: 'LOST',
    qualification: { rentBuy: 'rent', bhk: '2 BHK', budget: '80000', preferredProject: 'Sheth 72 West' },
  }), lead({ sourceId: 'req-lost', name: 'Lost' }));
  assert.equal(lost, null);

  assert.ok(ranged && lowBudget && otherBhk && buyer && bare && openFurnishing && matchingFlat && cheapFlat && saleFlat);

  const board = buildMarketOverview(
    [matchingFlat, cheapFlat, saleFlat],
    [ranged, lowBudget, otherBhk, buyer, bare, openFurnishing],
  );

  const pairIds = new Set(board.matches.map((match) => `${match.flatId}:${match.requirementId}`));
  assert.equal(pairIds.has('match-flat:housing_com:req-range'), true);
  assert.equal(pairIds.has('cheap-flat:housing_com:req-range'), false);
  assert.equal(pairIds.has('match-flat:housing_com:req-low'), false);
  assert.equal(pairIds.has('match-flat:housing_com:req-3'), false);
  assert.equal(pairIds.has('sale-flat:housing_com:req-buy'), true);
  assert.equal(pairIds.has('match-flat:housing_com:req-buy'), false);
  assert.equal(pairIds.has('match-flat:housing_com:req-bare'), false);
  assert.equal(pairIds.has('match-flat:housing_com:req-open'), true);
  assert.equal(board.flatsWithoutDemand.includes('cheap-flat'), true);
  assert.ok(board.requirementsWithoutSupply.includes('housing_com:req-low'));
  assert.ok(board.requirementsWithoutSupply.includes('housing_com:req-3'));
  assert.ok(board.requirementsWithoutSupply.includes('housing_com:req-bare'));
  assert.equal(board.flatsWithoutDemand.includes('match-flat'), false);

  const shethRent = board.gap.find((row) => row.project === 'Sheth 72 West · Andheri West' && row.bhk === '2 BHK');
  assert.ok(shethRent);
  assert.equal(shethRent.rentFlats, 2);
  assert.ok(shethRent.rentRequirements >= 1);
  assert.equal(shethRent.rentAction === 'push_ads' || shethRent.rentAction === 'broker_outreach' || shethRent.rentAction === 'balanced', true);

  const tenant = prospectToRequirement({
    ...ownerProspect,
    id: 'tenant-1',
    prospectType: 'tenant',
    name: 'Neha',
    intent: 'rent',
    projectName: 'Sheth 72 West',
    location: 'Andheri West',
    bhk: '2 BHK',
    budgetMin: '70000',
    budgetMax: '90000',
    furnishing: 'Furnished',
    requirement: '2BHK rent',
    unit: undefined,
    phone: '9111111111',
  });
  assert.ok(tenant);
  const withTenant = buildMarketOverview([matchingFlat], [tenant]);
  assert.equal(withTenant.matches.length, 1);
  assert.equal(withTenant.requirementsWithoutSupply.length, 0);

  const shortGap = buildMarketOverview([], [ranged, openFurnishing]);
  const shortRow = shortGap.gap.find((row) => row.bhk === '2 BHK' && row.project === 'Sheth 72 West · Andheri West');
  assert.ok(shortRow);
  assert.equal(shortRow.rentFlats, 0);
  assert.ok(shortRow.rentRequirements >= 1);
  assert.equal(shortRow.rentAction, 'broker_outreach');

  const surplus = buildMarketOverview([matchingFlat, cheapFlat], []);
  const surplusRow = surplus.gap.find((row) => row.project === 'Sheth 72 West · Andheri West' && row.bhk === '2 BHK');
  assert.ok(surplusRow);
  assert.equal(surplusRow.rentGap, 2);
  assert.equal(surplusRow.rentAction, 'push_ads');

  console.log('market board tests passed');
}

main();
