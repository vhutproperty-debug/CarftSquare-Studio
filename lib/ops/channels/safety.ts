export class ChannelSafetyError extends Error {
  status = 409;
}

/** New CraftSquare OS send paths stop here while the WABA is restricted. */
export function assertOsWhatsAppSendAllowed(paused: boolean): void {
  if (paused) {
    throw new ChannelSafetyError('WhatsApp sending is paused because the WABA is restricted.');
  }
}

export type PausedCampaignPlan = {
  name: string;
  status: 'PAUSED';
  activate: false;
  dailyBudgetInr: null;
};

/**
 * Local campaign plan. Always paused. Refuses activation and budget changes.
 * This does not call Meta.
 */
export function planPausedCampaign(input: {
  name?: string;
  status?: string;
  changeBudget?: boolean;
  dailyBudgetInr?: number;
}): PausedCampaignPlan {
  if (input.changeBudget || input.dailyBudgetInr != null) {
    throw new ChannelSafetyError('Budget changes are not available from CraftSquare OS automation.');
  }
  const requested = String(input.status || 'PAUSED').toUpperCase();
  if (requested !== 'PAUSED') {
    throw new ChannelSafetyError('Campaigns can only be created paused. Activation is not available.');
  }
  const name = String(input.name || '').trim();
  if (!name) throw new ChannelSafetyError('A campaign name is required.');
  return { name, status: 'PAUSED', activate: false, dailyBudgetInr: null };
}
