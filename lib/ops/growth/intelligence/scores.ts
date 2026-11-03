export type ScoreRule = {
  id: string;
  label: string;
  weight: number;
  applied: boolean;
  points: number;
};

export type ScoreWeights = {
  engagement: {
    metaForm: number;
    whatsappReply: number;
    repeatTouch: number;
  };
  qualification: {
    budget: number;
    configuration: number;
    location: number;
    possession: number;
    intent: number;
    inventoryMatch: number;
    duplicatePenalty: number;
  };
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  engagement: { metaForm: 40, whatsappReply: 40, repeatTouch: 20 },
  qualification: {
    budget: 20,
    configuration: 20,
    location: 20,
    possession: 15,
    intent: 15,
    inventoryMatch: 10,
    duplicatePenalty: 15,
  },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function rule(id: string, label: string, weight: number, applied: boolean): ScoreRule {
  return { id, label, weight, applied, points: applied ? weight : 0 };
}

export type EngagementInput = {
  source: 'meta_instant_form' | 'whatsapp_cloud' | 'other';
  replied: boolean;
  touches: number;
};

export function scoreEngagement(input: EngagementInput, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): { score: number; breakdown: ScoreRule[] } {
  const breakdown = [
    rule('metaForm', 'Meta Instant Form source', weights.engagement.metaForm, input.source === 'meta_instant_form'),
    rule('whatsappReply', 'WhatsApp reply received', weights.engagement.whatsappReply, input.source === 'whatsapp_cloud' && input.replied),
    rule('repeatTouch', 'More than one touch', weights.engagement.repeatTouch, input.touches > 1),
  ];
  return { score: clamp(breakdown.reduce((sum, item) => sum + item.points, 0)), breakdown };
}

export type QualificationInput = {
  budget: boolean;
  configuration: boolean;
  location: boolean;
  possession: boolean;
  intent: boolean;
  inventoryMatch: boolean;
  openDuplicate: boolean;
};

export function scoreQualification(input: QualificationInput, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): { score: number; breakdown: ScoreRule[] } {
  const weightsQ = weights.qualification;
  const breakdown = [
    rule('budget', 'Budget is present', weightsQ.budget, input.budget),
    rule('configuration', 'Configuration is present', weightsQ.configuration, input.configuration),
    rule('location', 'Location is present', weightsQ.location, input.location),
    rule('possession', 'Possession is present', weightsQ.possession, input.possession),
    rule('intent', 'Buy or rent intent is present', weightsQ.intent, input.intent),
    rule('inventoryMatch', 'An inventory filter matched', weightsQ.inventoryMatch, input.inventoryMatch),
    rule('duplicatePenalty', 'Open duplicate review subtracts', weightsQ.duplicatePenalty, input.openDuplicate),
  ];
  const positive = breakdown.filter((item) => item.id !== 'duplicatePenalty').reduce((sum, item) => sum + item.points, 0);
  const penalty = input.openDuplicate ? weightsQ.duplicatePenalty : 0;
  return { score: clamp(positive - penalty), breakdown: breakdown.map((item) => item.id === 'duplicatePenalty' ? { ...item, points: input.openDuplicate ? -weightsQ.duplicatePenalty : 0 } : item) };
}

export function sanitizeWeights(input: Partial<ScoreWeights> | null | undefined): ScoreWeights {
  const next = structuredClone(DEFAULT_SCORE_WEIGHTS);
  const engagement = input?.engagement;
  const qualification = input?.qualification;
  if (engagement) {
    for (const key of Object.keys(next.engagement) as Array<keyof ScoreWeights['engagement']>) {
      const value = Number(engagement[key]);
      if (Number.isFinite(value) && value >= 0 && value <= 100) next.engagement[key] = value;
    }
  }
  if (qualification) {
    for (const key of Object.keys(next.qualification) as Array<keyof ScoreWeights['qualification']>) {
      const value = Number(qualification[key]);
      if (Number.isFinite(value) && value >= 0 && value <= 100) next.qualification[key] = value;
    }
  }
  return next;
}
