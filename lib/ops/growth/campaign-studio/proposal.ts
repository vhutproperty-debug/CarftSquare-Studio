export type CampaignInventoryKind = 'developer_project' | 'resale_unit' | 'rental';

export type CampaignInventory = {
  id: string;
  kind: CampaignInventoryKind;
  name: string;
  locality: string;
  configuration: string;
  possession: string;
  intent: 'buy' | 'rent';
  priceLabel: string;
  priceCrore: number | null;
  approvedBecause: string;
};

export type CampaignCopy = {
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
};

export type CampaignProposalDraft = {
  inventoryId: string;
  inventoryKind: CampaignInventoryKind;
  projectName: string;
  locality: string;
  copy: CampaignCopy;
  audience: { localities: string[]; configuration: string; intent: 'buy' | 'rent' };
  budgetSuggestionInr: number;
  creativeBrief: { angle: string; visual: string; offer: string };
};

const ANGLES = [
  {
    angle: 'site_visit',
    cta: 'LEARN_MORE',
    headline: (item: CampaignInventory) => item.locality ? `Visit ${item.name}` : `Book a visit · ${item.name}`,
    text: (item: CampaignInventory) => `CraftSquare is scheduling visits for ${item.name}${item.locality ? ` in ${item.locality}` : ''}. ${item.configuration || 'Tell us the configuration'} · ${item.possession || 'ask us about possession'}.`,
  },
  {
    angle: 'configuration',
    cta: 'SIGN_UP',
    headline: (item: CampaignInventory) => item.configuration ? `${item.configuration} at ${item.name}` : item.name,
    text: (item: CampaignInventory) => `${item.name}${item.locality ? `, ${item.locality}` : ''}. ${item.intent === 'rent' ? 'Available to rent' : 'Available to buy'}${item.priceLabel ? ` · ${item.priceLabel}` : ''}. Share your number and CraftSquare will call you back.`,
  },
  {
    angle: 'possession',
    cta: 'CONTACT_US',
    headline: (item: CampaignInventory) => item.possession ? `${item.possession} · ${item.name}` : item.name,
    text: (item: CampaignInventory) => `Looking ${item.intent === 'rent' ? 'to rent' : 'to buy'}${item.locality ? ` in ${item.locality}` : ''}? ${item.name} ${item.possession ? `· ${item.possession}` : ''}. CraftSquare will match a visit slot.`,
  },
] as const;

export function approvalForInventory(input: {
  kind: CampaignInventoryKind;
  status?: string;
  channelPartnerStatus?: string;
}): { approved: boolean; because: string } {
  if (input.kind === 'developer_project') {
    const approved = input.channelPartnerStatus === 'empanelled' && input.status !== 'sold_out';
    return {
      approved,
      because: approved ? 'Channel partner is empanelled and the project is still on the market.' : '',
    };
  }
  if (input.kind === 'resale_unit') {
    const approved = input.status === 'for_sale' || input.status === 'for_rent' || input.status === 'available';
    return { approved, because: approved ? 'Resale unit is listed for sale or rent.' : '' };
  }
  const approved = input.status === 'available';
  return { approved, because: approved ? 'Rental listing is available.' : '' };
}

/** Template suggestion only. Creating a campaign uses this as the initial paused budget and never raises it later. */
export function suggestDailyBudgetInr(item: Pick<CampaignInventory, 'intent' | 'priceCrore'>): number {
  if (item.intent === 'rent') return 800;
  if (item.priceCrore == null || item.priceCrore < 3) return 1500;
  if (item.priceCrore < 8) return 2500;
  return 4000;
}

function angleFor(id: string) {
  let index = 0;
  for (const char of id) index = (index + char.charCodeAt(0)) % ANGLES.length;
  return ANGLES[index];
}

export function buildCampaignProposal(item: CampaignInventory): CampaignProposalDraft {
  const angle = angleFor(item.id);
  const locality = item.locality.trim();
  return {
    inventoryId: item.id,
    inventoryKind: item.kind,
    projectName: item.name,
    locality,
    copy: {
      primaryText: angle.text(item),
      headline: angle.headline(item).slice(0, 80),
      description: `${item.intent === 'rent' ? 'Rent' : 'Buy'} with CraftSquare. ${item.approvedBecause}`.slice(0, 140),
      cta: angle.cta,
    },
    audience: {
      localities: locality ? [locality, 'Mumbai'] : ['Mumbai'],
      configuration: item.configuration,
      intent: item.intent,
    },
    budgetSuggestionInr: suggestDailyBudgetInr(item),
    creativeBrief: {
      angle: angle.angle,
      visual: `Photo of ${item.name}${locality ? ` in ${locality}` : ''}, with the configuration and possession on the frame. No price callout unless ${item.priceLabel || 'a price'} is already public.`,
      offer: item.intent === 'rent'
        ? 'Book a rental visit. No obligation.'
        : 'Book a site visit. No obligation.',
    },
  };
}

export function budgetAfterReview(suggestion: number, requested?: number | null): number {
  const next = requested == null || Number.isNaN(requested) ? suggestion : requested;
  if (!(next > 0)) throw new Error('Budget must be greater than zero.');
  if (next > suggestion) throw new Error('The approved budget cannot be higher than the suggestion.');
  return next;
}

export const ACTIVATE_PHRASE = 'ACTIVATE';

export function assertCanReview(isSuperAdmin: boolean): void {
  if (!isSuperAdmin) throw new Error('Only a super admin can review a campaign proposal.');
}

export function assertCanCreatePaused(input: {
  isSuperAdmin: boolean;
  status: string;
  permissionsAvailable: boolean;
}): void {
  if (!input.isSuperAdmin) throw new Error('Only a super admin can create a campaign on Meta.');
  if (input.status !== 'approved') throw new Error('Approve the proposal before creating it on Meta.');
  if (!input.permissionsAvailable) {
    throw new Error('Meta permissions are not available. The proposal stays approved and nothing was created.');
  }
}

export function assertCanActivate(input: {
  isSuperAdmin: boolean;
  confirm: string;
  status: string;
  metaStatus: string;
  permissionsAvailable: boolean;
  activeSpendAllowed: boolean;
}): void {
  if (!input.isSuperAdmin) throw new Error('Only a super admin can activate a campaign.');
  if (input.confirm !== ACTIVATE_PHRASE) {
    throw new Error('Type ACTIVATE to confirm. Campaigns are never activated automatically.');
  }
  if (input.status !== 'paused_on_meta' || input.metaStatus !== 'PAUSED') {
    throw new Error('Only a paused Meta campaign can be activated.');
  }
  if (!input.permissionsAvailable) throw new Error('Meta permissions are not available. The campaign stays paused.');
  if (!input.activeSpendAllowed) throw new Error('Active spend is locked. The campaign stays paused.');
}

export function metaCreateGate(readiness: {
  canPublishPaused: boolean;
  permissions: string[];
  blockers: string[];
}): { available: boolean; missing: string[]; message: string } {
  const needed = ['ads_management', 'pages_manage_ads'];
  const missing = needed.filter((permission) => !readiness.permissions.includes(permission));
  const available = readiness.canPublishPaused && missing.length === 0;
  const message = available
    ? ''
    : readiness.blockers[0]
      || (missing.length ? `Missing Meta permissions: ${missing.join(', ')}.` : 'Meta permissions are not available.');
  return { available, missing, message };
}
