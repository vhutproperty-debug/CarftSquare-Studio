export {
  MAX_CONSULT_QUESTIONS,
  PROJECT_CATEGORY_FIELD,
  RESIDENTIAL_FIELDS,
  RENTAL_FIELDS,
  OFFICE_FIELDS,
  COMMERCIAL_FIELDS,
  getFieldsForModule,
  fieldToQuestion,
} from './fields';
export {
  PROJECT_CATEGORY_OPTIONS,
  getProjectCategory,
  needsCategorySelection,
  resolveModuleFromCategory,
  normalizeProjectCategory,
} from './categories';
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
