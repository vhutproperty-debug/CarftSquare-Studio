import type { EstimateAnswers, EstimateModuleId } from '../types';
import type { QuestionDef } from '../modules/interior';
import { getProjectCategory, normalizeProjectCategory, PROJECT_CATEGORY_FIELD } from './categories';

export interface ConsultField {
  id: string;
  text: string;
  options?: string[];
  type: 'choice' | 'number' | 'text';
  required: boolean;
  priority: number;
  when?: (answers: EstimateAnswers) => boolean;
}

export { PROJECT_CATEGORY_FIELD };

const BUDGET_RESIDENTIAL = ['Under ₹8L', '₹8L – ₹15L', '₹15L – ₹25L', '₹25L – ₹40L', '₹40L+'];
const BUDGET_RENTAL = ['Under ₹3L', '₹3L – ₹6L', '₹6L – ₹10L', '₹10L+'];
const BUDGET_COMMERCIAL = ['Under ₹10L', '₹10L – ₹25L', '₹25L – ₹50L', '₹50L – ₹1Cr', '₹1Cr+'];
const CITIES = ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'];

export const RESIDENTIAL_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your property in?', options: CITIES, type: 'choice', required: true, priority: 1 },
  { id: 'bedrooms', text: 'How many bedrooms (BHK)?', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK+'], type: 'choice', required: true, priority: 2 },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number', required: true, priority: 3 },
  { id: 'possession', text: 'When is your possession date / project timeline?', options: ['Immediately', 'Within 1 month', '1–3 months', '3–6 months', 'Flexible'], type: 'choice', required: true, priority: 4 },
  { id: 'budget', text: 'What is your approximate budget range?', options: BUDGET_RESIDENTIAL, type: 'choice', required: true, priority: 5 },
  { id: 'furnishingScope', text: 'What is your furnishing scope?', options: ['Full Home', 'Kitchen + Wardrobes', 'Living + Bedrooms', 'Selected Rooms', 'Turnkey'], type: 'choice', required: true, priority: 6 },
];

export const RENTAL_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is the property in?', options: CITIES, type: 'choice', required: true, priority: 1 },
  { id: 'propertyType', text: 'What is the property type?', options: ['Studio', '1 BHK', '2 BHK', '3 BHK', 'Villa'], type: 'choice', required: true, priority: 2 },
  { id: 'tenantType', text: 'Who is your target tenant?', options: ['Family', 'Bachelor', 'Corporate', 'Airbnb Guest'], type: 'choice', required: true, priority: 3 },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number', required: true, priority: 4 },
  { id: 'furnishingLevel', text: 'What furnishing level are you looking for?', options: ['Basic', 'Premium', 'Luxury'], type: 'choice', required: true, priority: 5 },
  { id: 'budget', text: 'What is your furnishing budget?', options: BUDGET_RENTAL, type: 'choice', required: true, priority: 6 },
];

export const OFFICE_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your office located in?', options: CITIES, type: 'choice', required: true, priority: 1 },
  { id: 'carpetArea', text: 'What is the office carpet area in sq.ft?', type: 'number', required: true, priority: 2 },
  { id: 'employeeCount', text: 'How many employees will use this space?', options: ['1-10', '11-25', '26-50', '51-100', '100+'], type: 'choice', required: true, priority: 3 },
  { id: 'cabins', text: 'How many private cabins do you need?', options: ['0', '1', '2-3', '4-6', '7+'], type: 'choice', required: true, priority: 4 },
  { id: 'workstations', text: 'How many workstations are required?', options: ['Up to 10', '11-25', '26-50', '51-100', '100+'], type: 'choice', required: true, priority: 5 },
  { id: 'conferenceRoom', text: 'Do you need a conference room?', options: ['Yes', 'No', 'Maybe later'], type: 'choice', required: true, priority: 6 },
  { id: 'budget', text: 'What is your interior budget range?', options: BUDGET_COMMERCIAL, type: 'choice', required: true, priority: 7 },
];

export const COMMERCIAL_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is the property in?', options: CITIES, type: 'choice', required: true, priority: 1 },
  { id: 'businessType', text: 'What is your business type?', type: 'text', required: true, priority: 2 },
  { id: 'carpetArea', text: 'What is the area in sq.ft?', type: 'number', required: true, priority: 3 },
  { id: 'displayRequirements', text: 'What are your display requirements?', options: ['Minimal', 'Moderate', 'High Visibility', 'Premium Showcase'], type: 'choice', required: true, priority: 4 },
  { id: 'storagePriority', text: 'How important is storage?', options: ['Essential', 'Important', 'Moderate', 'Not a priority'], type: 'choice', required: true, priority: 5 },
  { id: 'brandingNeeds', text: 'What are your branding needs?', options: ['Basic Signage', 'Branded Interiors', 'Full Brand Experience', 'Not sure'], type: 'choice', required: true, priority: 6 },
  { id: 'budget', text: 'What is your project budget?', options: BUDGET_COMMERCIAL, type: 'choice', required: true, priority: 7 },
];

export const KITCHEN_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your property in?', options: CITIES, type: 'choice', required: true, priority: 1 },
  { id: 'carpetArea', text: 'What is the kitchen area in sq.ft?', type: 'number', required: true, priority: 2 },
  { id: 'budget', text: 'What is your kitchen budget range?', options: BUDGET_RESIDENTIAL, type: 'choice', required: true, priority: 3 },
  { id: 'designStyle', text: 'Which kitchen style do you prefer?', options: ['Modern Minimal', 'Contemporary', 'Luxury Classic', 'Industrial'], type: 'choice', required: false, priority: 4 },
];

export const WARDROBE_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your property in?', options: CITIES, type: 'choice', required: true, priority: 1 },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number', required: true, priority: 2 },
  { id: 'bedrooms', text: 'How many wardrobes do you need?', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK+'], type: 'choice', required: true, priority: 3 },
  { id: 'budget', text: 'What is your wardrobe budget range?', options: BUDGET_RESIDENTIAL, type: 'choice', required: true, priority: 4 },
];

export const MAX_CONSULT_QUESTIONS = 8;

function fieldsForCategory(category: string): ConsultField[] {
  const normalized = normalizeProjectCategory(category);
  switch (normalized) {
    case 'Rental Furnishing':
      return RENTAL_FIELDS;
    case 'Office':
      return OFFICE_FIELDS;
    case 'Commercial Shop':
    case 'Showroom':
    case 'Restaurant/Cafe':
    case 'Clinic/Hospital':
    case 'Hotel/Hospitality':
    case 'Educational Space':
    case 'Other':
      return COMMERCIAL_FIELDS;
    default:
      return RESIDENTIAL_FIELDS;
  }
}

export function getFieldsForModule(entryModuleId: EstimateModuleId, answers: EstimateAnswers): ConsultField[] {
  const category = normalizeProjectCategory(String(answers.projectCategory || ''));
  if (category) {
    if (entryModuleId === 'modular-kitchen' && category === 'Residential') return KITCHEN_FIELDS;
    if (entryModuleId === 'wardrobe' && category === 'Residential') return WARDROBE_FIELDS;
    return fieldsForCategory(category);
  }

  if (entryModuleId === 'rental-furnishing') return RENTAL_FIELDS;
  if (entryModuleId === 'modular-kitchen') return KITCHEN_FIELDS;
  if (entryModuleId === 'wardrobe') return WARDROBE_FIELDS;
  if (entryModuleId === 'office-interior') return OFFICE_FIELDS;
  if (entryModuleId === 'commercial-interior') return COMMERCIAL_FIELDS;

  return fieldsForCategory(getProjectCategory(answers, entryModuleId));
}

export function fieldToQuestion(field: ConsultField): QuestionDef {
  return { id: field.id, text: field.text, options: field.options, type: field.type, when: field.when };
}

export function isFieldAnswered(answers: EstimateAnswers, fieldId: string): boolean {
  const value = answers[fieldId];
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function countAnsweredFields(fields: ConsultField[], answers: EstimateAnswers): number {
  return fields.filter((f) => isFieldAnswered(answers, f.id)).length;
}
