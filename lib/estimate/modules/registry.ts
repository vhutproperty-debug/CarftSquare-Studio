import { getNextConsultQuestion, isConsultComplete } from '../consultant';
import type { EstimateAnswers, EstimateModuleId } from '../types';
import { INTERIOR_QUESTIONS, type QuestionDef } from './interior';
import { RENTAL_QUESTIONS } from './rental-furnishing';
import {
  needsQualification,
  QUALIFICATION_QUESTION,
  resolveActiveModule,
  resolvePropertyPurpose,
} from './qualification';

export { QUALIFICATION_QUESTION, resolveActiveModule, resolvePropertyPurpose, needsQualification };

export function getQuestionsForModule(moduleId: EstimateModuleId): QuestionDef[] {
  switch (moduleId) {
    case 'rental-furnishing':
      return RENTAL_QUESTIONS;
    case 'modular-kitchen':
      return INTERIOR_QUESTIONS.filter((q) =>
        ['city', 'carpetArea', 'bedrooms', 'budget', 'designStyle', 'modularKitchen', 'specialRequirements'].includes(q.id),
      );
    case 'wardrobe':
      return INTERIOR_QUESTIONS.filter((q) =>
        ['city', 'carpetArea', 'bedrooms', 'budget', 'wardrobes', 'storagePriority', 'specialRequirements'].includes(q.id),
      );
    default:
      return INTERIOR_QUESTIONS;
  }
}

export function getNextQuestion(entryModuleId: EstimateModuleId, answers: EstimateAnswers): QuestionDef | null {
  return getNextConsultQuestion(entryModuleId, answers);
}

export function isConversationComplete(entryModuleId: EstimateModuleId, answers: EstimateAnswers): boolean {
  return isConsultComplete(entryModuleId, answers);
}

export function getModuleLandingPath(moduleId: EstimateModuleId): string {
  const paths: Record<EstimateModuleId, string> = {
    'home-interior': '/estimate',
    'rental-furnishing': '/estimate/rental-furnishing',
    'modular-kitchen': '/estimate/kitchen',
    'wardrobe': '/estimate/wardrobe',
    'office-interior': '/estimate/office',
    'commercial-interior': '/estimate/commercial',
  };
  return paths[moduleId];
}
