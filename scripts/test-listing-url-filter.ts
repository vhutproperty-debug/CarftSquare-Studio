/**
 * Smoke + unit checks for genuine property listing URL filters.
 *
 * Fails if nav/marketing/city-landing URLs are accepted.
 * Passes when portal property detail URLs are accepted.
 *
 * Run: npm run test:listing-urls
 */

import {
  isGenuineListingUrl,
  isHousingListingUrl,
  isMagicbricksListingUrl,
  isNobrokerListingUrl,
  isNinetyNineAcresListingUrl,
  isSquareyardsListingUrl,
} from '../connectors/common/listing-url';

type Case = { portal: string; url: string; expect: boolean; label: string };

const CASES: Case[] = [
  // NoBroker — reject
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/list-your-property-for-rent-sale',
    expect: false,
    label: 'NB post property',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/rental-agreement',
    expect: false,
    label: 'NB rental agreement',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/buyer/plans',
    expect: false,
    label: 'NB buyer plans',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/pay-property-rent-online?xyz=1',
    expect: false,
    label: 'NB pay rent',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/property/rent/mumbai/andheri-west',
    expect: false,
    label: 'NB locality SERP',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/property/rent/mumbai/andheri-west_search-list',
    expect: false,
    label: 'NB search-list',
  },
  // NoBroker — accept
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/property/rent/mumbai/andheri-west/lake-homes/8a9f7c2e1b',
    expect: true,
    label: 'NB rent detail',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/property/sale/bangalore/whitefield/tower-a/ab12cd34ef',
    expect: true,
    label: 'NB sale detail',
  },
  {
    portal: 'nobroker',
    url: 'https://www.nobroker.in/flats-for-sale-in-andheri_west_mumbai',
    expect: false,
    label: 'NB flats-for-sale landing',
  },

  // SquareYards — reject
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/online-property-valuation',
    expect: false,
    label: 'SY valuation',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/buy-vs-rent-calculator',
    expect: false,
    label: 'SY buy vs rent',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/guide/buyer-guide',
    expect: false,
    label: 'SY guide',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/sale/property-for-sale-in-mumbai',
    expect: false,
    label: 'SY city landing',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/property-rates-in-mumbai',
    expect: false,
    label: 'SY rates',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/rent',
    expect: false,
    label: 'SY bare rent',
  },
  // SquareYards — accept
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/rent/2-bhk-apartment-for-rent-in-andheri-west-mumbai-123456',
    expect: true,
    label: 'SY rent detail',
  },
  {
    portal: 'squareyards',
    url: 'https://www.squareyards.com/sale/property/3-bhk-in-powai-987654',
    expect: true,
    label: 'SY sale detail',
  },

  // Housing
  {
    portal: 'housing',
    url: 'https://housing.com/rent/19337910-1000-sqft-2-bhk-apartment-on-rent-in-malad-west-mumbai',
    expect: true,
    label: 'Housing rent detail',
  },
  {
    portal: 'housing',
    url: 'https://housing.com/in/rent/mumbai/andheri',
    expect: false,
    label: 'Housing locality shell',
  },

  // MagicBricks
  {
    portal: 'magicbricks',
    url: 'https://www.magicbricks.com/propertyDetails/2-BHK-900-Sq-ft-Multistorey-Apartment-FOR-Rent-Andheri-West-&id=4d4234&ppid=12345',
    expect: true,
    label: 'MB propertyDetails',
  },
  {
    portal: 'magicbricks',
    url: 'https://www.magicbricks.com/property-for-rent/residential-real-estate?cityName=Mumbai',
    expect: false,
    label: 'MB SERP',
  },

  // 99acres
  {
    portal: '99acres',
    url: 'https://www.99acres.com/2-bhk-bedroom-apartment-for-rent-spid-A12345678',
    expect: true,
    label: '99acres spid',
  },
  {
    portal: '99acres',
    url: 'https://www.99acres.com/search/property/rent/mumbai?keyword=andheri',
    expect: false,
    label: '99acres SERP',
  },
];

function assertPortalHelpers() {
  if (!isNobrokerListingUrl('https://www.nobroker.in/property/rent/mumbai/x/y/abcdef12')) {
    throw new Error('helper isNobrokerListingUrl broken');
  }
  if (!isSquareyardsListingUrl('https://www.squareyards.com/rent/foo-123456')) {
    throw new Error('helper isSquareyardsListingUrl broken');
  }
  if (!isHousingListingUrl('https://housing.com/rent/19337910-1000-sqft-2-bhk-apartment-on-rent-in-x')) {
    throw new Error('helper isHousingListingUrl broken');
  }
  if (!isMagicbricksListingUrl('https://www.magicbricks.com/propertyDetails/x-ppid-1')) {
    throw new Error('helper isMagicbricksListingUrl broken');
  }
  if (!isNinetyNineAcresListingUrl('https://www.99acres.com/x-spid-A1')) {
    throw new Error('helper isNinetyNineAcresListingUrl broken');
  }
}

function main() {
  assertPortalHelpers();
  let failed = 0;
  for (const c of CASES) {
    const got = isGenuineListingUrl(c.portal, c.url);
    const ok = got === c.expect;
    console.log(`${ok ? 'PASS' : 'FAIL'} [${c.portal}] ${c.label} → ${got} (want ${c.expect})`);
    if (!ok) {
      failed += 1;
      console.log(`       ${c.url}`);
    }
  }
  if (failed) {
    console.error(`\n${failed} listing-url filter case(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${CASES.length} listing-url filter cases passed.`);
}

main();
