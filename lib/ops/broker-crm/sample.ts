import { applyBrokerCrmPatch } from '@/lib/ops/broker-crm/patch';
import { buildBrokerCrmRecord } from '@/lib/ops/broker-crm/record';
import type { OpsBrokerCrmRecord } from '@/lib/ops/broker-crm/types';

const NOW = '2026-04-02T09:00:00.000Z';

function base(partial: {
  id: string;
  phone: string;
  name: string;
  groups: string[];
  admin?: boolean;
}): OpsBrokerCrmRecord {
  return buildBrokerCrmRecord({
    ...partial,
    admin: Boolean(partial.admin),
    createdAt: '2026-04-01T09:00:00.000Z',
    updatedAt: NOW,
    importedAt: '2026-04-01T09:00:00.000Z',
  });
}

/** Obvious stand-ins for screenshots and local preview. Not real directory numbers. */
export function sampleBrokerCrmRecords(): OpsBrokerCrmRecord[] {
  const asha = applyBrokerCrmPatch(base({
    id: 'sample-asha',
    phone: '9100000001',
    name: 'Asha Kulkarni (sample)',
    groups: ['Agent Group Andheri', 'Goregaon East broker group', 'EKTA WORLD PROJECTS'],
    admin: true,
  }), {
    status: 'active',
    lastContactedAt: '2026-03-28',
    areaTags: ['Lokhandwala'],
    notes: 'Asked what configurations clients are hunting in Andheri. Internal note only.',
    requirements: [{
      id: 'sample-req-asha',
      bhk: '2 BHK',
      budgetBandId: 'rent_60_80',
      area: 'Andheri',
      project: 'Ekta World',
      intent: 'rent',
      active: true,
    }],
  }, NOW);

  const rohan = applyBrokerCrmPatch(base({
    id: 'sample-rohan',
    phone: '9100000002',
    name: 'Rohan Mehta (sample)',
    groups: ['Malad goregaon (e,w) property information.', 'Mumbai Central to Borivali 🏡 Rental Property', 'Oberoi Sky City'],
  }), {
    status: 'contacted',
    lastContactedAt: '2026-03-18',
    requirements: [{
      id: 'sample-req-rohan',
      bhk: '3 BHK',
      budgetBandId: 'buy_2_3',
      area: 'Borivali',
      project: 'Oberoi Sky City',
      intent: 'buy',
      active: true,
    }],
  }, NOW);

  const neelam = base({
    id: 'sample-neelam',
    phone: '9100000003',
    name: 'Neelam Desai (sample)',
    groups: ['Oberoi Sky City'],
  });

  const imran = applyBrokerCrmPatch(base({
    id: 'sample-imran',
    phone: '9100000004',
    name: 'Imran Shaikh (sample)',
    groups: ['KALPATARU RADIANCE ONLY'],
    admin: true,
  }), {
    status: 'new',
    projectTags: ['Kalpataru Radiance'],
  }, NOW);

  const farhan = applyBrokerCrmPatch(base({
    id: 'sample-farhan',
    phone: '9100000005',
    name: 'Farhan Qureshi (sample)',
    groups: ['Andheri to Malad Agent Group', 'NEELKANTH PROPERTIES'],
  }), {
    status: 'do-not-contact',
    doNotContactReason: 'Asked not to be contacted',
    requirements: [{
      id: 'sample-req-farhan',
      bhk: '2 BHK',
      budgetBandId: 'rent_40_60',
      area: 'Malad',
      project: '',
      intent: 'rent',
      active: true,
    }],
  }, NOW);

  const unnamed = base({
    id: 'sample-unnamed',
    phone: '9100000006',
    name: '',
    groups: ['NEELKANTH PROPERTIES'],
  });

  const kavita = applyBrokerCrmPatch(base({
    id: 'sample-kavita',
    phone: '9100000007',
    name: 'Kavita Joshi (sample)',
    groups: ['LODHA RAJ INFINIA', 'Omkar Alta Monte'],
  }), {
    status: 'dormant',
    lastContactedAt: '2025-11-02',
    requirements: [{
      id: 'sample-req-kavita',
      bhk: '3 BHK',
      budgetBandId: 'rent_120_200',
      area: 'Goregaon',
      project: 'Lodha Raj Infinia',
      intent: 'rent',
      active: true,
    }],
  }, NOW);

  const priya = base({
    id: 'sample-priya',
    phone: '9100000008',
    name: 'Priya Nair (sample)',
    groups: ['EKTA TRIPOLIS ONLY', 'Agent Group Andheri'],
  });

  const vikram = applyBrokerCrmPatch(base({
    id: 'sample-vikram',
    phone: '9100000009',
    name: 'Vikram Rao (sample)',
    admin: true,
    groups: [
      'Agent Group Andheri',
      'Goregaon East broker group',
      'EKTA WORLD PROJECTS',
      'Oberoi Sky City',
      'KALPATARU RADIANCE ONLY',
    ],
  }), {
    status: 'new',
  }, NOW);

  const lata = base({
    id: 'sample-lata',
    phone: '9100000010',
    name: 'Lata Bhosle (sample)',
    groups: [
      'Andheri to Malad Agent Group',
      'NEELKANTH PROPERTIES',
      'Malad goregaon (e,w) property information.',
      'Mumbai Central to Borivali rental',
      'LODHA RAJ INFINIA',
    ],
  });

  const sameer = applyBrokerCrmPatch(base({
    id: 'sample-sameer',
    phone: '9100000011',
    name: 'Sameer Iyer (sample)',
    groups: [
      'EKTA WORLD PROJECTS',
      'EKTA TRIPOLIS ONLY',
      'Omkar Alta Monte',
      'Oberoi Sky City',
      'Agent Group Andheri',
      'Goregaon East broker group',
    ],
  }), {
    status: 'contacted',
    lastContactedAt: '2026-03-30',
  }, NOW);

  return [sameer, vikram, lata, asha, rohan, neelam, imran, farhan, unnamed, kavita, priya];
}
