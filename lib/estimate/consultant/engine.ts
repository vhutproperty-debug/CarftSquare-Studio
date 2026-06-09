import type { EstimateAnswers, EstimateModuleId } from '../types';
import { needsQualification } from '../modules/qualification';
import type { QuestionDef } from '../modules/interior';
import {
  countAnsweredFields,
  fieldToQuestion,
  getFieldsForModule,
  isFieldAnswered,
  MAX_CONSULT_QUESTIONS,
  QUALIFICATION_FIELD,
  type ConsultField,
} from './fields';

export function applyPricingDefaults(answers: EstimateAnswers, activeModuleId: EstimateModuleId): EstimateAnswers {
  const result = { ...answers };

  if (!isFieldAnswered(result, 'city')) result.city = 'Mumbai';
  if (!isFieldAnswered(result, 'projectType') && activeModuleId === 'home-interior') {
    result.projectType = 'Home Interior';
  }
  if (!isFieldAnswered(result, 'ownership')) result.ownership = 'Owned';
  if (!isFieldAnswered(result, 'designStyle') && !isFieldAnswered(result, 'furnishingLevel')) {
    result.designStyle = 'Contemporary';
  }
  if (!isFieldAnswered(result, 'storagePriority')) result.storagePriority = 'Important';
  if (!isFieldAnswered(result, 'familySize')) result.familySize = '3-4';
  if (!isFieldAnswered(result, 'possession') && !isFieldAnswered(result, 'possessionDate')) {
    result.possession = 'Flexible';
  }
  if (activeModuleId === 'rental-furnishing') {
    if (!isFieldAnswered(result, 'furnishingLevel')) result.furnishingLevel = 'Premium';
    if (!isFieldAnswered(result, 'furnitureRequired')) result.furnitureRequired = 'Yes';
    if (!isFieldAnswered(result, 'rentalType')) result.rentalType = 'Long-term Rental';
  }

  return result;
}

function getRequiredFields(fields: ConsultField[], answers: EstimateAnswers): ConsultField[] {
  return fields.filter((f) => f.required && (!f.when || f.when(answers)));
}

function getMissingFields(fields: ConsultField[], answers: EstimateAnswers): ConsultField[] {
  return fields
    .filter((f) => !isFieldAnswered(answers, f.id))
    .filter((f) => !f.when || f.when(answers))
    .sort((a, b) => a.priority - b.priority);
}

export function getConsultQuestionCount(answers: EstimateAnswers): number {
  return Object.keys(answers).filter((k) => {
    const v = answers[k];
    return v !== undefined && v !== null && String(v).trim() !== '' && k !== 'propertyPurposeRaw';
  }).length;
}

export function getNextConsultQuestion(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): QuestionDef | null {
  if (needsQualification(entryModuleId, answers)) {
    return fieldToQuestion(QUALIFICATION_FIELD);
  }

  const fields = getFieldsForModule(entryModuleId, answers);
  const required = getRequiredFields(fields, answers);
  const missing = getMissingFields(fields, answers);
  const questionCount = getConsultQuestionCount(answers);

  const allRequiredMet = required.every((f) => isFieldAnswered(answers, f.id));
  if (allRequiredMet && (missing.length === 0 || questionCount >= MAX_CONSULT_QUESTIONS)) {
    return null;
  }

  if (allRequiredMet && questionCount >= MAX_CONSULT_QUESTIONS) {
    return null;
  }

  const next = missing[0];
  return next ? fieldToQuestion(next) : null;
}

export function isConsultComplete(entryModuleId: EstimateModuleId, answers: EstimateAnswers): boolean {
  return getNextConsultQuestion(entryModuleId, answers) === null;
}

export function getConsultProgress(answers: EstimateAnswers, entryModuleId: EstimateModuleId): {
  answered: number;
  total: number;
} {
  if (needsQualification(entryModuleId, answers)) {
    return { answered: 0, total: MAX_CONSULT_QUESTIONS };
  }
  const fields = getFieldsForModule(entryModuleId, answers);
  const answered = countAnsweredFields(fields, answers);
  return { answered, total: MAX_CONSULT_QUESTIONS };
}
