import type { EstimateAnswers, EstimateModuleId } from '../types';
import type { QuestionDef } from '../modules/interior';

export interface ConsultField {
  id: string;
  text: string;
  options?: string[];
  type: 'choice' | 'number' | 'text';
  required: boolean;
  priority: number;
  when?: (answers: EstimateAnswers) => boolean;
}

export const QUALIFICATION_FIELD: ConsultField = {
  id: 'propertyPurpose',
  text: 'What is the purpose of this property?',
  options: ['Own Residence', 'Rental Income'],
  type: 'choice',
  required: true,
  priority: 0,
};

export const OWN_RESIDENCE_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your property in?', options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'], type: 'choice', required: true, priority: 1 },
  { id: 'bedrooms', text: 'How many bedrooms does the property have?', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK+'], type: 'choice', required: true, priority: 2 },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number', required: true, priority: 3 },
  { id: 'budget', text: 'What is your approximate budget range?', options: ['Under ₹8L', '₹8L – ₹15L', '₹15L – ₹25L', '₹25L – ₹40L', '₹40L+'], type: 'choice', required: true, priority: 4 },
  { id: 'designStyle', text: 'Which design style appeals to you most?', options: ['Modern Minimal', 'Contemporary', 'Scandinavian', 'Luxury Classic', 'Industrial'], type: 'choice', required: false, priority: 5 },
  { id: 'familySize', text: 'How many family members will live here?', options: ['1-2', '3-4', '5-6', '7+'], type: 'choice', required: false, priority: 6 },
  { id: 'storagePriority', text: 'How important is storage optimization?', options: ['Essential', 'Important', 'Moderate', 'Not a priority'], type: 'choice', required: false, priority: 7 },
  { id: 'possession', text: 'When would you like the project completed?', options: ['Immediately', 'Within 1 month', '1–3 months', '3–6 months', 'Flexible'], type: 'choice', required: false, priority: 8 },
];

export const RENTAL_FIELDS: ConsultField[] = [
  { id: 'propertyType', text: 'What is the property type?', options: ['Studio', '1 BHK', '2 BHK', '3 BHK', 'Villa'], type: 'choice', required: true, priority: 1 },
  { id: 'city', text: 'Which city is the property in?', options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'], type: 'choice', required: true, priority: 2 },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number', required: true, priority: 3 },
  { id: 'rentalType', text: 'Is this for long-term rental or Airbnb?', options: ['Long-term Rental', 'Airbnb / Short Stay'], type: 'choice', required: false, priority: 4 },
  { id: 'furnishingLevel', text: 'What furnishing level are you looking for?', options: ['Basic', 'Premium', 'Luxury'], type: 'choice', required: false, priority: 5 },
  { id: 'budget', text: 'What is your furnishing budget?', options: ['Under ₹3L', '₹3L – ₹6L', '₹6L – ₹10L', '₹10L+'], type: 'choice', required: true, priority: 6 },
  { id: 'possessionDate', text: 'When do you need possession / handover?', options: ['Immediately', 'Within 2 weeks', 'Within 1 month', '1–3 months', 'Flexible'], type: 'choice', required: false, priority: 7 },
];

export const KITCHEN_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your property in?', options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'], type: 'choice', required: true, priority: 1 },
  { id: 'carpetArea', text: 'What is the kitchen area in sq.ft (or overall carpet area)?', type: 'number', required: true, priority: 2 },
  { id: 'budget', text: 'What is your kitchen budget range?', options: ['Under ₹8L', '₹8L – ₹15L', '₹15L – ₹25L', '₹25L – ₹40L', '₹40L+'], type: 'choice', required: true, priority: 3 },
  { id: 'designStyle', text: 'Which kitchen style do you prefer?', options: ['Modern Minimal', 'Contemporary', 'Scandinavian', 'Luxury Classic', 'Industrial'], type: 'choice', required: false, priority: 4 },
  { id: 'modularKitchen', text: 'Any specific kitchen layout preference?', options: ['L-shaped', 'U-shaped', 'Parallel', 'Island', 'Not sure'], type: 'choice', required: false, priority: 5 },
];

export const WARDROBE_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your property in?', options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'], type: 'choice', required: true, priority: 1 },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number', required: true, priority: 2 },
  { id: 'bedrooms', text: 'How many wardrobes do you need?', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK+'], type: 'choice', required: true, priority: 3 },
  { id: 'budget', text: 'What is your wardrobe budget range?', options: ['Under ₹8L', '₹8L – ₹15L', '₹15L – ₹25L', '₹25L – ₹40L', '₹40L+'], type: 'choice', required: true, priority: 4 },
  { id: 'storagePriority', text: 'How important is storage optimization?', options: ['Essential', 'Important', 'Moderate', 'Not a priority'], type: 'choice', required: false, priority: 5 },
];

export const OFFICE_FIELDS: ConsultField[] = [
  { id: 'city', text: 'Which city is your office located in?', options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'], type: 'choice', required: true, priority: 1 },
  { id: 'carpetArea', text: 'What is the office carpet area in sq.ft?', type: 'number', required: true, priority: 2 },
  { id: 'budget', text: 'What is your interior budget range?', options: ['Under ₹8L', '₹8L – ₹15L', '₹15L – ₹25L', '₹25L – ₹40L', '₹40L+'], type: 'choice', required: true, priority: 3 },
  { id: 'designStyle', text: 'Which design style suits your brand?', options: ['Modern Minimal', 'Contemporary', 'Scandinavian', 'Luxury Classic', 'Industrial'], type: 'choice', required: false, priority: 4 },
  { id: 'familySize', text: 'How many team members will use this space?', options: ['1-2', '3-4', '5-6', '7+'], type: 'choice', required: false, priority: 5 },
];

export const MAX_CONSULT_QUESTIONS = 6;

export function getFieldsForModule(entryModuleId: EstimateModuleId, answers: EstimateAnswers): ConsultField[] {
  if (entryModuleId === 'rental-furnishing') return RENTAL_FIELDS;
  if (entryModuleId === 'modular-kitchen') return KITCHEN_FIELDS;
  if (entryModuleId === 'wardrobe') return WARDROBE_FIELDS;
  if (entryModuleId === 'office-interior') return OFFICE_FIELDS;
  if (entryModuleId === 'commercial-interior') return OFFICE_FIELDS;

  const purpose = String(answers.propertyPurpose || '');
  if (purpose.includes('Rental')) return RENTAL_FIELDS;
  return OWN_RESIDENCE_FIELDS;
}

export function fieldToQuestion(field: ConsultField): QuestionDef {
  return {
    id: field.id,
    text: field.text,
    options: field.options,
    type: field.type,
    when: field.when,
  };
}

export function isFieldAnswered(answers: EstimateAnswers, fieldId: string): boolean {
  const value = answers[fieldId];
  return value !== undefined && value !== null && String(value).trim() !== '';
}

export function countAnsweredFields(fields: ConsultField[], answers: EstimateAnswers): number {
  return fields.filter((f) => isFieldAnswered(answers, f.id)).length;
}
