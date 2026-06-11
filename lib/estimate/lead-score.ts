import type { ConversationMessage, EstimateAnswers } from './types';

export function extractTimeline(answers: EstimateAnswers): string {
  return String(answers.possession || answers.possessionDate || answers.timeline || 'Flexible');
}

export function calculateLeadScore(
  answers: EstimateAnswers,
  conversation: ConversationMessage[],
  customer?: { name?: string; phone?: string; email?: string },
): number {
  let score = 15;

  if (answers.projectCategory || answers.projectType) score += 10;
  if (answers.budget) score += 15;
  if (answers.carpetArea) score += 10;
  if (answers.bedrooms || answers.propertyType) score += 5;
  if (answers.city) score += 5;

  const userMessages = conversation.filter((m) => m.role === 'user').length;
  score += Math.min(userMessages * 4, 20);

  if (customer?.name) score += 10;
  if (customer?.phone) score += 10;
  if (customer?.email) score += 5;

  const budget = String(answers.budget || '').toLowerCase();
  if (budget.includes('40') || budget.includes('25') || budget.includes('10l+')) score += 5;

  return Math.min(100, score);
}
