export {
  MAX_CONSULT_QUESTIONS,
  QUALIFICATION_FIELD,
  OWN_RESIDENCE_FIELDS,
  RENTAL_FIELDS,
  getFieldsForModule,
  fieldToQuestion,
} from './fields';
export { extractAnswersFromMessage } from './extractor';
export {
  applyPricingDefaults,
  getNextConsultQuestion,
  isConsultComplete,
  getConsultQuestionCount,
  getConsultProgress,
} from './engine';
export {
  validateConsultationAnswers,
  getMissingConsultationFields,
  normalizePhone,
  isValidIndianPhone,
} from './validation';
