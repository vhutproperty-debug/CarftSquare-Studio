import type { EstimateAnswers } from '../types';
import type { QuestionDef } from './interior';

const yesNo = ['Yes', 'No'];

export const RENTAL_QUESTIONS: QuestionDef[] = [
  {
    id: 'propertyType',
    text: 'What is the property type?',
    options: ['Studio', '1 BHK', '2 BHK', '3 BHK', 'Villa'],
    type: 'choice',
  },
  {
    id: 'city',
    text: 'Which city is the property in?',
    options: ['Mumbai', 'Navi Mumbai', 'Thane', 'Pune', 'Other'],
    type: 'choice',
  },
  {
    id: 'carpetArea',
    text: 'What is the approximate carpet area in sq.ft?',
    type: 'number',
  },
  {
    id: 'rentalType',
    text: 'Is this for long-term rental or Airbnb?',
    options: ['Long-term Rental', 'Airbnb / Short Stay'],
    type: 'choice',
  },
  {
    id: 'tenantType',
    text: 'What is the expected tenant profile?',
    options: ['Family', 'Bachelor', 'Corporate'],
    type: 'choice',
  },
  {
    id: 'targetMonthlyRent',
    text: 'What is your target monthly rent?',
    options: ['Under ₹25,000', '₹25,000 – ₹40,000', '₹40,000 – ₹60,000', '₹60,000 – ₹1L', '₹1L+'],
    type: 'choice',
  },
  {
    id: 'furnishingLevel',
    text: 'What furnishing level are you looking for?',
    options: ['Basic', 'Premium', 'Luxury'],
    type: 'choice',
  },
  {
    id: 'furnitureRequired',
    text: 'Is a full furniture package required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'appliancesRequired',
    text: 'Are appliances required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'curtains',
    text: 'Are curtains required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'mattress',
    text: 'Are mattresses required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'dining',
    text: 'Is a dining set required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'tvUnit',
    text: 'Is a TV unit required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'studyTable',
    text: 'Is a study table required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'wardrobes',
    text: 'Are wardrobes required?',
    options: yesNo,
    type: 'choice',
  },
  {
    id: 'budget',
    text: 'What is your furnishing budget?',
    options: ['Under ₹3L', '₹3L – ₹6L', '₹6L – ₹10L', '₹10L+'],
    type: 'choice',
  },
  {
    id: 'possessionDate',
    text: 'When do you need possession / handover?',
    options: ['Immediately', 'Within 2 weeks', 'Within 1 month', '1–3 months', 'Flexible'],
    type: 'choice',
  },
  {
    id: 'specialRequirements',
    text: 'Any special requirements for your rental property?',
    type: 'text',
  },
];

export function getNextRentalQuestion(answers: EstimateAnswers): QuestionDef | null {
  for (const question of RENTAL_QUESTIONS) {
    if (answers[question.id] !== undefined && answers[question.id] !== '') continue;
    if (question.when && !question.when(answers)) continue;
    return question;
  }
  return null;
}
