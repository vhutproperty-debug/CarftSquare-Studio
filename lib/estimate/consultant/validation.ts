import type { EstimateAnswers, EstimateModuleId } from '../types';
import { getFieldsForModule, isFieldAnswered, QUALIFICATION_FIELD } from './fields';
import { needsQualification } from '../modules/qualification';

export interface ConsultationValidation {
  ready: boolean;
  missing: string[];
}

const FIELD_LABELS: Record<string, string> = {
  propertyPurpose: 'Property Purpose',
  city: 'City',
  bedrooms: 'Property Type',
  propertyType: 'Property Type',
  carpetArea: 'Property Size',
  budget: 'Budget Range',
  possession: 'Possession Timeline',
  possessionDate: 'Possession Timeline',
};

export function getMissingConsultationFields(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): string[] {
  const missing: string[] = [];

  if (needsQualification(entryModuleId, answers)) {
    missing.push(FIELD_LABELS.propertyPurpose);
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

  if (!isFieldAnswered(answers, QUALIFICATION_FIELD.id) && entryModuleId === 'home-interior') {
    if (!missing.includes(FIELD_LABELS.propertyPurpose)) {
      missing.push(FIELD_LABELS.propertyPurpose);
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
