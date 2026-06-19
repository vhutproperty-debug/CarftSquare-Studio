export const META_LANDING_PATH = '/free-interior-consultation';

export const WELCOME_MESSAGE = `Welcome to CraftSquare.

We're here to understand your interior requirements and prepare a personalized estimate based on your preferences.

Answer a few simple questions to receive:

• Personalized Interior Estimate
• Budget Guidance
• Design Direction
• Free Expert Consultation

⏱️ Takes Less Than 60 Seconds`;

export const CONTACT_ACK_MESSAGE = (name) =>
  `Thank you, ${name}! Just a few more quick questions to refine your estimate.`;

export const CONSULTATION_STEPS = [
  {
    id: 'designFocus',
    type: 'options',
    assistant: 'What would you like to design today?',
    options: [
      'New Home Interiors',
      'Home Renovation',
      'Rental Furnishing',
      'Modular Kitchen',
      'Painting & Makeover',
      'Commercial Space',
    ],
  },
  {
    id: 'city',
    type: 'text',
    assistant: 'Which city is your property in?',
    placeholder: 'e.g. Mumbai',
  },
  {
    id: 'locality',
    type: 'text',
    assistant: 'Which locality or project?',
    placeholder: 'e.g. Andheri West, Lodha Park',
  },
  {
    id: 'contact',
    type: 'contact',
    earlyCapture: true,
    assistant: `Almost done!

Please enter your Name and Mobile Number so we can save your estimate and assign a design expert.`,
    submitLabel: 'Continue',
  },
  {
    id: 'bhk',
    type: 'options',
    assistant: 'What is the configuration?',
    options: ['1 BHK', '2 BHK', '3 BHK', '4 BHK'],
  },
  {
    id: 'possessionType',
    type: 'options',
    assistant: 'Is this a new possession or renovation?',
    options: ['New Possession', 'Renovation'],
  },
  {
    id: 'carpetArea',
    type: 'text',
    assistant: 'Approx carpet area in sq.ft?',
    placeholder: 'e.g. 850',
    inputMode: 'numeric',
  },
  {
    id: 'budget',
    type: 'options',
    assistant: 'What is your budget range?',
    options: ['Under ₹5L', '₹5L–₹10L', '₹10L–₹20L', 'Premium'],
  },
  {
    id: 'timeline',
    type: 'options',
    assistant: 'Expected timeline?',
    options: ['Immediate', '1 Month', '3 Months', 'Planning Stage'],
    isFinal: true,
  },
];

export function formatConsultationSummary(answers = {}) {
  const lines = [
    `Design Focus: ${answers.designFocus || '—'}`,
    `City: ${answers.city || '—'}`,
    `Locality: ${answers.locality || '—'}`,
    `Property: ${answers.bhk || '—'}`,
    `Type: ${answers.possessionType || '—'}`,
    `Carpet Area: ${answers.carpetArea ? `${answers.carpetArea} sq.ft` : '—'}`,
    `Budget: ${answers.budget || '—'}`,
    `Timeline: ${answers.timeline || '—'}`,
  ];
  return `Meta Ads AI Consultation\n${lines.join('\n')}`;
}

export function mapProjectType(answers = {}) {
  const focus = String(answers.designFocus || '');
  if (/rental/i.test(focus)) return 'Rental Property';
  if (/commercial/i.test(focus)) return 'Commercial';
  return 'Home';
}
