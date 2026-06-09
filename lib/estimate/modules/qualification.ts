import type { EstimateAnswers, EstimateModuleId, PropertyPurpose } from '../types';
import type { QuestionDef } from './interior';

export const QUALIFICATION_QUESTION: QuestionDef = {
  id: 'propertyPurpose',
  text: 'What is the purpose of this property?',
  options: ['Own Residence', 'Rental Income'],
  type: 'choice',
};

export function normalizePropertyPurpose(raw: string): PropertyPurpose | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.includes('Own Residence') || value.includes('live here')) return 'Own Residence';
  if (value.includes('Rental Income') || value.includes('Rental Furnishing') || value.includes('furnish it for Rental')) return 'Rental Furnishing';
  if (value === 'Own Residence' || value === 'Rental Furnishing') return value as PropertyPurpose;
  return null;
}

export function needsQualification(entryModuleId: EstimateModuleId, answers: EstimateAnswers): boolean {
  return entryModuleId === 'home-interior' && !normalizePropertyPurpose(String(answers.propertyPurpose || ''));
}

export function resolveActiveModule(entryModuleId: EstimateModuleId, answers: EstimateAnswers): EstimateModuleId {
  if (entryModuleId === 'rental-furnishing') return 'rental-furnishing';
  if (entryModuleId !== 'home-interior') return entryModuleId;

  const purpose = normalizePropertyPurpose(String(answers.propertyPurpose || ''));
  if (purpose === 'Rental Furnishing') return 'rental-furnishing';
  return 'home-interior';
}

export function resolvePropertyPurpose(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): PropertyPurpose | null {
  const fromAnswer = normalizePropertyPurpose(String(answers.propertyPurpose || ''));
  if (fromAnswer) return fromAnswer;
  if (entryModuleId === 'rental-furnishing') return 'Rental Furnishing';
  return null;
}

export function applyPropertyPurposeAnswer(answers: EstimateAnswers, rawAnswer: string): EstimateAnswers {
  const normalized = normalizePropertyPurpose(rawAnswer);
  return {
    ...answers,
    propertyPurpose: normalized || rawAnswer,
    propertyPurposeRaw: rawAnswer,
  };
}
