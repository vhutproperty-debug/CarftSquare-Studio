import type { EstimateAnswers, EstimateModuleId } from '../types';
import { needsCategorySelection } from './categories';
import { getFieldsForModule, isFieldAnswered, PROJECT_CATEGORY_FIELD } from './fields';

export interface ConsultationValidation {
  ready: boolean;
  missing: string[];
}

const FIELD_LABELS: Record<string, string> = {
  projectCategory: 'Project Type',
  city: 'City',
  bedrooms: 'BHK',
  propertyType: 'Property Type',
  carpetArea: 'Property Size',
  budget: 'Budget Range',
  possession: 'Timeline',
  possessionDate: 'Timeline',
  furnishingScope: 'Furnishing Scope',
  tenantType: 'Target Tenant',
  furnishingLevel: 'Furnishing Level',
  employeeCount: 'Employee Count',
  businessType: 'Business Type',
};

export function getMissingConsultationFields(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): string[] {
  const missing: string[] = [];

  if (needsCategorySelection(entryModuleId, answers)) {
    missing.push(FIELD_LABELS.projectCategory);
    return missing;
  }

  const fields = getFieldsForModule(entryModuleId, answers);
  for (const field of fields) {
    if (!field.required) continue;
    if (field.when && !field.when(answers)) continue;
    if (!isFieldAnswered(answers, field.id)) {
      missing.push(FIELD_LABELS[field.id] || field.text);
    }
  }

  return missing;
}

export function validateConsultationAnswers(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): ConsultationValidation {
  const missing = getMissingConsultationFields(entryModuleId, answers);
  return { ready: missing.length === 0, missing };
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}

export function isValidIndianPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return /^[6-9]\d{9}$/.test(digits);
}
