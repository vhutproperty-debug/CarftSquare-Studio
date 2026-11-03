export type AttributionLead = { id: string; campaignId: string; qualified: boolean };
export type AttributionVisit = { id: string; dealId: string; status: string };
export type AttributionDeal = { id: string; project: string };
export type AttributionPayment = { id: string; dealId: string; amount: number; verified: boolean; deletedAt?: string | null };
export type AttributionLink = { leadId: string; dealId: string };

export type CampaignAttribution = {
  campaignId: string;
  projectName: string;
  spend: number | null;
  qualifiedLeads: number;
  siteVisits: number;
  deals: number;
  collected: number;
  costPerQualifiedLead: number | null;
  costPerSiteVisit: number | null;
  roi: number | null;
  spendError: string;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function attributeCampaign(input: {
  campaignId: string;
  projectName: string;
  spend: number | null;
  spendError?: string;
  leads: AttributionLead[];
  visits: AttributionVisit[];
  deals: AttributionDeal[];
  payments: AttributionPayment[];
  links: AttributionLink[];
}): CampaignAttribution {
  const leads = input.leads.filter((lead) => lead.campaignId === input.campaignId);
  const leadIds = new Set(leads.map((lead) => lead.id));
  const linkedDealIds = new Set(input.links.filter((link) => leadIds.has(link.leadId)).map((link) => link.dealId));
  const deals = input.deals.filter((deal) => linkedDealIds.has(deal.id) || (input.projectName && deal.project === input.projectName));
  const dealIds = new Set(deals.map((deal) => deal.id));
  const visits = input.visits.filter((visit) => visit.status !== 'cancelled' && dealIds.has(visit.dealId));
  const collected = input.payments
    .filter((payment) => payment.verified && !payment.deletedAt && dealIds.has(payment.dealId))
    .reduce((sum, payment) => sum + (Number.isFinite(payment.amount) ? payment.amount : 0), 0);
  const qualifiedLeads = leads.filter((lead) => lead.qualified).length;
  const spend = input.spend;
  return {
    campaignId: input.campaignId,
    projectName: input.projectName,
    spend,
    qualifiedLeads,
    siteVisits: visits.length,
    deals: deals.length,
    collected: roundMoney(collected),
    costPerQualifiedLead: spend != null && qualifiedLeads > 0 ? roundMoney(spend / qualifiedLeads) : null,
    costPerSiteVisit: spend != null && visits.length > 0 ? roundMoney(spend / visits.length) : null,
    roi: spend != null && spend > 0 ? roundRatio((collected - spend) / spend) : null,
    spendError: input.spendError || '',
  };
}
