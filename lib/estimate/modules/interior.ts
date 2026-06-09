import type { EstimateAnswers } from '../types';

export interface QuestionDef {
  id: string;
  text: string;
  options?: string[];
  type: 'choice' | 'number' | 'text';
  when?: (answers: EstimateAnswers) => boolean;
}

export const INTERIOR_QUESTIONS: QuestionDef[] = [
  { id: 'projectType', text: 'What type of project are you planning?', options: ['Home Interior', 'Renovation', 'Turnkey Project', 'Partial Rooms'], type: 'choice' },
  { id: 'city', text: 'Which city is your property in?', options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'], type: 'choice' },
  { id: 'ownership', text: 'Is this an owned property or rental property?', options: ['Owned', 'Rental'], type: 'choice' },
  { id: 'carpetArea', text: 'What is the approximate carpet area in sq.ft?', type: 'number' },
  { id: 'bedrooms', text: 'How many bedrooms does the property have?', options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK+'], type: 'choice' },
  { id: 'bathrooms', text: 'How many bathrooms?', options: ['1', '2', '3', '4+'], type: 'choice' },
  { id: 'familySize', text: 'How many family members will live here?', options: ['1-2', '3-4', '5-6', '7+'], type: 'choice' },
  { id: 'possession', text: 'What is your possession status?', options: ['Ready to move', 'Under construction', 'Renovation in occupied home'], type: 'choice' },
  { id: 'budget', text: 'What is your approximate budget range?', options: ['Under ₹8L', '₹8L – ₹15L', '₹15L – ₹25L', '₹25L – ₹40L', '₹40L+'], type: 'choice' },
  { id: 'designStyle', text: 'Which design style appeals to you most?', options: ['Modern Minimal', 'Contemporary', 'Scandinavian', 'Luxury Classic', 'Industrial'], type: 'choice' },
  { id: 'storagePriority', text: 'How important is storage optimization?', options: ['Essential', 'Important', 'Moderate', 'Not a priority'], type: 'choice' },
  { id: 'modularKitchen', text: 'Do you require a modular kitchen?', options: ['Yes', 'No', 'Maybe later'], type: 'choice' },
  { id: 'wardrobes', text: 'Do you need custom wardrobes?', options: ['Yes, all bedrooms', 'Yes, master only', 'No'], type: 'choice' },
  { id: 'falseCeiling', text: 'Would you like false ceiling work?', options: ['Full home', 'Living + bedrooms', 'Selected rooms', 'No'], type: 'choice' },
  { id: 'lighting', text: 'Are you interested in professional lighting design?', options: ['Yes', 'Basic only', 'No'], type: 'choice' },
  { id: 'smartHome', text: 'Would you like smart home features?', options: ['Yes', 'Future-ready wiring only', 'No'], type: 'choice' },
  { id: 'furniture', text: 'Do you need a furniture package?', options: ['Full home', 'Living + dining', 'Selected items', 'No'], type: 'choice' },
  { id: 'appliances', text: 'Should we include appliances in scope?', options: ['Yes', 'Kitchen only', 'No'], type: 'choice' },
  { id: 'specialRequirements', text: 'Any special requirements? (Vastu, elderly-friendly, pet-friendly, work-from-home, etc.)', type: 'text' },
];

export function getNextInteriorQuestion(answers: EstimateAnswers): QuestionDef | null {
  for (const question of INTERIOR_QUESTIONS) {
    if (answers[question.id] !== undefined && answers[question.id] !== '') continue;
    if (question.when && !question.when(answers)) continue;
    if (answers.ownership === 'Rental' && ['modularKitchen', 'smartHome'].includes(question.id)) continue;
    return question;
  }
  return null;
}
