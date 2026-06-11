import type { EstimateAnswers, EstimateModuleId } from '../types';
import type { ConsultField } from './fields';

export const PROJECT_CATEGORY_OPTIONS = [
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
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORY_OPTIONS)[number];

export const PROJECT_CATEGORY_FIELD: ConsultField = {
  id: 'projectCategory',
  text: 'What type of project are you planning?',
  options: [...PROJECT_CATEGORY_OPTIONS],
  type: 'choice',
  required: true,
  priority: 0,
};

export function normalizeProjectCategory(raw: string): ProjectCategory | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const match = PROJECT_CATEGORY_OPTIONS.find(
    (o) => o.toLowerCase() === value.toLowerCase() || value.toLowerCase().includes(o.toLowerCase()),
  );
  return match || null;
}

export function needsCategorySelection(_entryModuleId: EstimateModuleId, answers: EstimateAnswers): boolean {
  return !normalizeProjectCategory(String(answers.projectCategory || ''));
}

export function resolveModuleFromCategory(category: string): EstimateModuleId {
  const normalized = normalizeProjectCategory(category);
  switch (normalized) {
    case 'Rental Furnishing':
      return 'rental-furnishing';
    case 'Office':
      return 'office-interior';
    case 'Commercial Shop':
    case 'Showroom':
    case 'Restaurant/Cafe':
    case 'Clinic/Hospital':
    case 'Hotel/Hospitality':
    case 'Educational Space':
    case 'Other':
      return 'commercial-interior';
    default:
      return 'home-interior';
  }
}

export function getProjectCategory(answers: EstimateAnswers, entryModuleId: EstimateModuleId): string {
  const fromAnswer = normalizeProjectCategory(String(answers.projectCategory || ''));
  if (fromAnswer) return fromAnswer;
  const map: Partial<Record<EstimateModuleId, string>> = {
    'rental-furnishing': 'Rental Furnishing',
    'office-interior': 'Office',
    'commercial-interior': 'Commercial Shop',
    'modular-kitchen': 'Residential',
    'wardrobe': 'Residential',
  };
  return map[entryModuleId] || 'Residential';
}
