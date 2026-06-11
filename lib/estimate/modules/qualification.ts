import type { EstimateAnswers, EstimateModuleId, PropertyPurpose } from '../types';
import {
  normalizeProjectCategory,
  resolveModuleFromCategory,
} from '../consultant/categories';
import type { QuestionDef } from './interior';

/** @deprecated Use PROJECT_CATEGORY_FIELD from consultant/categories */
export const QUALIFICATION_QUESTION: QuestionDef = {
  id: 'projectCategory',
  text: 'What type of project are you planning?',
  options: [
    'Residential',
    'Rental Furnishing',
    'Office',
    'Commercial Shop',
    'Showroom',
    'Restaurant/Cafe',
    'Clinic/Hospital',
    'Hotel/Hospitality',
    'Educational Space',
    'Other',
  ],
  type: 'choice',
};

export function normalizePropertyPurpose(raw: string): PropertyPurpose | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (value.includes('Own Residence') || value.includes('live here') || value === 'Residential') return 'Own Residence';
  if (value.includes('Rental')) return 'Rental Furnishing';
  if (value === 'Own Residence' || value === 'Rental Furnishing') return value as PropertyPurpose;
  return null;
}

export function needsQualification(_entryModuleId: EstimateModuleId, answers: EstimateAnswers): boolean {
  return !normalizeProjectCategory(String(answers.projectCategory || ''));
}

export function resolveActiveModule(entryModuleId: EstimateModuleId, answers: EstimateAnswers): EstimateModuleId {
  const category = String(answers.projectCategory || '');
  if (category) return resolveModuleFromCategory(category);
  if (entryModuleId !== 'home-interior') return entryModuleId;
  const purpose = normalizePropertyPurpose(String(answers.propertyPurpose || ''));
  if (purpose === 'Rental Furnishing') return 'rental-furnishing';
  return 'home-interior';
}

export function resolvePropertyPurpose(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): PropertyPurpose | null {
  const category = normalizeProjectCategory(String(answers.projectCategory || ''));
  if (category === 'Rental Furnishing') return 'Rental Furnishing';
  if (category && category !== 'Rental Furnishing') return 'Own Residence';
  const fromAnswer = normalizePropertyPurpose(String(answers.propertyPurpose || ''));
  if (fromAnswer) return fromAnswer;
  if (entryModuleId === 'rental-furnishing') return 'Rental Furnishing';
  return null;
}

export function applyPropertyPurposeAnswer(answers: EstimateAnswers, rawAnswer: string): EstimateAnswers {
  const category = normalizeProjectCategory(rawAnswer);
  if (category) {
    return { ...answers, projectCategory: category, propertyPurpose: category === 'Rental Furnishing' ? 'Rental Furnishing' : 'Own Residence' };
  }
  const normalized = normalizePropertyPurpose(rawAnswer);
  return { ...answers, propertyPurpose: normalized || rawAnswer, propertyPurposeRaw: rawAnswer };
}
