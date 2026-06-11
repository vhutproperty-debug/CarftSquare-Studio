import type { EstimateAnswers, EstimateModuleId } from '../types';
import type { QuestionDef } from '../modules/interior';
import { needsCategorySelection, PROJECT_CATEGORY_FIELD } from './categories';
import {
  countAnsweredFields,
  fieldToQuestion,
  getFieldsForModule,
  isFieldAnswered,
  MAX_CONSULT_QUESTIONS,
  type ConsultField,
} from './fields';

export function applyPricingDefaults(answers: EstimateAnswers, activeModuleId: EstimateModuleId): EstimateAnswers {
  const result = { ...answers };

  if (!isFieldAnswered(result, 'city')) result.city = 'Mumbai';
  if (!isFieldAnswered(result, 'projectType')) {
    result.projectType = String(result.projectCategory || 'Interior Project');
  }
  if (!isFieldAnswered(result, 'designStyle') && !isFieldAnswered(result, 'furnishingLevel')) {
    result.designStyle = 'Contemporary';
  }
  if (!isFieldAnswered(result, 'storagePriority')) result.storagePriority = 'Important';
  if (!isFieldAnswered(result, 'familySize') && isFieldAnswered(result, 'employeeCount')) {
    result.familySize = String(result.employeeCount);
  }
  if (!isFieldAnswered(result, 'possession') && !isFieldAnswered(result, 'possessionDate')) {
    result.possession = 'Flexible';
  }
  if (activeModuleId === 'rental-furnishing') {
    if (!isFieldAnswered(result, 'furnishingLevel')) result.furnishingLevel = 'Premium';
    if (!isFieldAnswered(result, 'furnitureRequired')) result.furnitureRequired = 'Yes';
  }
  if (result.projectCategory && !result.businessType && activeModuleId === 'commercial-interior') {
    result.businessType = String(result.projectCategory);
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
    return v !== undefined && v !== null && String(v).trim() !== '' && !k.endsWith('Raw');
  }).length;
}

export function getNextConsultQuestion(
  entryModuleId: EstimateModuleId,
  answers: EstimateAnswers,
): QuestionDef | null {
  if (needsCategorySelection(entryModuleId, answers)) {
    return fieldToQuestion(PROJECT_CATEGORY_FIELD);
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
  if (needsCategorySelection(entryModuleId, answers)) {
    return { answered: 0, total: MAX_CONSULT_QUESTIONS };
  }
  const fields = getFieldsForModule(entryModuleId, answers);
  return { answered: countAnsweredFields(fields, answers), total: MAX_CONSULT_QUESTIONS };
}
