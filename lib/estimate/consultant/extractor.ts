import type { EstimateAnswers, EstimateModuleId } from '../types';
import { applyPropertyPurposeAnswer, normalizePropertyPurpose } from '../modules/qualification';
import { normalizeProjectCategory, PROJECT_CATEGORY_OPTIONS } from './categories';
import { getFieldsForModule, isFieldAnswered } from './fields';

const STYLE_MAP: Record<string, string> = {
  'modern minimal': 'Modern Minimal',
  'modern luxury': 'Luxury Classic',
  'luxury': 'Luxury Classic',
  'luxury classic': 'Luxury Classic',
  'contemporary': 'Contemporary',
  'scandinavian': 'Scandinavian',
  'industrial': 'Industrial',
  'minimal': 'Modern Minimal',
  'minimalist': 'Modern Minimal',
};

const BUDGET_PATTERNS: Array<{ pattern: RegExp; value: string }> = [
  { pattern: /under\s*₹?\s*3\s*l/i, value: 'Under ₹3L' },
  { pattern: /under\s*₹?\s*8\s*l/i, value: 'Under ₹8L' },
  { pattern: /₹?\s*3\s*l\s*[–-]\s*₹?\s*6\s*l/i, value: '₹3L – ₹6L' },
  { pattern: /₹?\s*6\s*l\s*[–-]\s*₹?\s*10\s*l/i, value: '₹6L – ₹10L' },
  { pattern: /₹?\s*8\s*l\s*[–-]\s*₹?\s*15\s*l/i, value: '₹8L – ₹15L' },
  { pattern: /₹?\s*15\s*l\s*[–-]\s*₹?\s*25\s*l/i, value: '₹15L – ₹25L' },
  { pattern: /₹?\s*25\s*l\s*[–-]\s*₹?\s*40\s*l/i, value: '₹25L – ₹40L' },
  { pattern: /₹?\s*40\s*l\s*\+|above\s*40\s*l|40\s*lakh/i, value: '₹40L+' },
  { pattern: /₹?\s*10\s*l\s*\+|10\s*lakh/i, value: '₹10L+' },
  { pattern: /(\d+)\s*lakh/i, value: '' },
];

function extractCity(text: string): string | null {
  const lower = text.toLowerCase();
  if (/navi\s*mumbai/i.test(text)) return 'Navi Mumbai';
  if (/\bthane\b/i.test(lower)) return 'Thane';
  if (/\bpune\b/i.test(lower)) return 'Pune';
  if (/\bmumbai\b/i.test(lower)) return 'Mumbai';
  return null;
}

function extractBhk(text: string): string | null {
  const match = text.match(/(\d)\s*bhk/i);
  if (match) return `${match[1]} BHK`;
  if (/studio/i.test(text)) return 'Studio';
  if (/villa/i.test(text)) return 'Villa';
  if (/4\s*bhk|four\s*bhk/i.test(text)) return '4 BHK+';
  return null;
}

function extractArea(text: string): number | null {
  const sqft = text.match(/(\d{2,5})\s*(?:sq\.?\s*ft|sqft|square\s*feet|carpet)/i);
  if (sqft) return Number(sqft[1]);
  const bare = text.match(/\b(\d{3,5})\s*(?:sq|square)?\b/i);
  if (bare && Number(bare[1]) >= 150) return Number(bare[1]);
  return null;
}

function extractStyle(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, value] of Object.entries(STYLE_MAP)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

function extractBudget(text: string): string | null {
  for (const { pattern, value } of BUDGET_PATTERNS) {
    if (pattern.test(text)) {
      if (value) return value;
      const m = text.match(/(\d+)\s*lakh/i);
      if (m) {
        const lakhs = Number(m[1]);
        if (lakhs < 8) return 'Under ₹8L';
        if (lakhs < 15) return '₹8L – ₹15L';
        if (lakhs < 25) return '₹15L – ₹25L';
        if (lakhs < 40) return '₹25L – ₹40L';
        return '₹40L+';
      }
    }
  }
  return null;
}

function extractFamilySize(text: string): string | null {
  const members = text.match(/family\s*of\s*(\d+)|(\d+)\s*(?:members?|people|persons?)/i);
  const count = members ? Number(members[1] || members[2]) : null;
  if (count) {
    if (count <= 2) return '1-2';
    if (count <= 4) return '3-4';
    if (count <= 6) return '5-6';
    return '7+';
  }
  if (/couple|two of us|just us/i.test(text)) return '1-2';
  if (/joint family|large family/i.test(text)) return '5-6';
  return null;
}

function extractStorage(text: string): string | null {
  const lower = text.toLowerCase();
  if (/lots of storage|maximum storage|storage is essential|need lots of wardrobe/i.test(lower)) return 'Essential';
  if (/important.*storage|good storage|ample storage/i.test(lower)) return 'Important';
  if (/moderate storage|some storage/i.test(lower)) return 'Moderate';
  if (/storage.*not|don't need much storage/i.test(lower)) return 'Not a priority';
  return null;
}

function extractTimeline(text: string): string | null {
  const lower = text.toLowerCase();
  if (/immediately|asap|urgent|right away/i.test(lower)) return 'Immediately';
  if (/within\s*2\s*weeks|two weeks/i.test(lower)) return 'Within 2 weeks';
  if (/within\s*1\s*month|next month/i.test(lower)) return 'Within 1 month';
  if (/1\s*[–-]\s*3\s*months|2\s*months|3\s*months/i.test(lower)) return '1–3 months';
  if (/3\s*[–-]\s*6\s*months/i.test(lower)) return '3–6 months';
  if (/flexible|no rush/i.test(lower)) return 'Flexible';
  return null;
}

function extractRentalType(text: string): string | null {
  if (/airbnb|short\s*stay|short-term/i.test(text)) return 'Airbnb / Short Stay';
  if (/long[\s-]*term|monthly rental/i.test(text)) return 'Long-term Rental';
  return null;
}

function extractFurnishingLevel(text: string): string | null {
  if (/luxury/i.test(text)) return 'Luxury';
  if (/premium/i.test(text)) return 'Premium';
  if (/basic|essential|budget/i.test(text)) return 'Basic';
  return null;
}

function extractPropertyPurpose(text: string): string | null {
  const purpose = normalizePropertyPurpose(text);
  if (purpose === 'Own Residence') return 'Own Residence';
  if (purpose === 'Rental Furnishing') return 'Rental Income';
  if (/own residence|live here|personal home/i.test(text)) return 'Own Residence';
  if (/rental income|rent it out|tenant|landlord|investment property/i.test(text)) return 'Rental Income';
  return null;
}

function extractProjectType(text: string): string | null {
  if (/renovation|renovate/i.test(text)) return 'Renovation';
  if (/turnkey/i.test(text)) return 'Turnkey Project';
  if (/partial|specific rooms/i.test(text)) return 'Partial Rooms';
  if (/home interior|full home|complete interior/i.test(text)) return 'Home Interior';
  return null;
}

function matchOptionValue(text: string, options: string[]): string | null {
  const trimmed = text.trim();
  const exact = options.find((o) => o.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const partial = options.find((o) => trimmed.toLowerCase().includes(o.toLowerCase()) || o.toLowerCase().includes(trimmed.toLowerCase()));
  return partial || null;
}

export function extractFromMessageRegex(
  message: string,
  entryModuleId: EstimateModuleId,
  currentAnswers: EstimateAnswers,
): Partial<EstimateAnswers> {
  const extracted: Partial<EstimateAnswers> = {};
  const text = message.trim();
  if (!text) return extracted;

  const category = normalizeProjectCategory(text);
  if (category && !isFieldAnswered(currentAnswers, 'projectCategory')) {
    extracted.projectCategory = category;
  }

  for (const opt of PROJECT_CATEGORY_OPTIONS) {
    if (text.toLowerCase().includes(opt.toLowerCase()) && !isFieldAnswered(currentAnswers, 'projectCategory')) {
      extracted.projectCategory = opt;
      break;
    }
  }

  const purpose = extractPropertyPurpose(text);
  if (purpose && !isFieldAnswered(currentAnswers, 'propertyPurpose')) {
    extracted.propertyPurpose = purpose;
  }

  const city = extractCity(text);
  if (city && !isFieldAnswered(currentAnswers, 'city')) extracted.city = city;

  const bhk = extractBhk(text);
  if (bhk) {
    if (!isFieldAnswered(currentAnswers, 'bedrooms')) extracted.bedrooms = bhk;
    if (!isFieldAnswered(currentAnswers, 'propertyType')) extracted.propertyType = bhk;
  }

  const area = extractArea(text);
  if (area && !isFieldAnswered(currentAnswers, 'carpetArea')) extracted.carpetArea = area;

  const style = extractStyle(text);
  if (style && !isFieldAnswered(currentAnswers, 'designStyle')) extracted.designStyle = style;

  const budget = extractBudget(text);
  if (budget && !isFieldAnswered(currentAnswers, 'budget')) extracted.budget = budget;

  const family = extractFamilySize(text);
  if (family && !isFieldAnswered(currentAnswers, 'familySize')) extracted.familySize = family;

  const storage = extractStorage(text);
  if (storage && !isFieldAnswered(currentAnswers, 'storagePriority')) extracted.storagePriority = storage;

  const timeline = extractTimeline(text);
  if (timeline) {
    if (!isFieldAnswered(currentAnswers, 'possession')) extracted.possession = timeline;
    if (!isFieldAnswered(currentAnswers, 'possessionDate')) extracted.possessionDate = timeline;
  }

  const rentalType = extractRentalType(text);
  if (rentalType && !isFieldAnswered(currentAnswers, 'rentalType')) extracted.rentalType = rentalType;

  const furnishing = extractFurnishingLevel(text);
  if (furnishing && !isFieldAnswered(currentAnswers, 'furnishingLevel')) extracted.furnishingLevel = furnishing;

  const projectType = extractProjectType(text);
  if (projectType && !isFieldAnswered(currentAnswers, 'projectType')) extracted.projectType = projectType;

  if (entryModuleId === 'home-interior' && !isFieldAnswered(currentAnswers, 'projectType') && !extracted.projectType) {
    extracted.projectType = 'Home Interior';
  }

  if (/owned|own property/i.test(text) && !isFieldAnswered(currentAnswers, 'ownership')) {
    extracted.ownership = 'Owned';
  }
  if (/rental property|rented flat/i.test(text) && !isFieldAnswered(currentAnswers, 'ownership')) {
    extracted.ownership = 'Rental';
  }

  return extracted;
}

export async function extractFromMessageAI(
  message: string,
  entryModuleId: EstimateModuleId,
  currentAnswers: EstimateAnswers,
): Promise<Partial<EstimateAnswers>> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return {};

  const fields = getFieldsForModule(entryModuleId, currentAnswers);
  const fieldIds = ['projectCategory', 'propertyPurpose', ...fields.map((f) => f.id)];

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `Extract interior consultation fields from the user message. Return JSON with only fields clearly stated. Valid field IDs: ${fieldIds.join(', ')}. For projectCategory use: ${PROJECT_CATEGORY_OPTIONS.join(', ')}. For bedrooms use "1 BHK","2 BHK","3 BHK","4 BHK+". For city use Mumbai, Navi Mumbai, Thane, Pune, or Other. carpetArea must be a number. Do not guess — omit uncertain fields.`,
          },
          {
            role: 'user',
            content: `Current answers: ${JSON.stringify(currentAnswers)}\nUser message: ${message}`,
          },
        ],
      }),
    });

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return {};

    const parsed = JSON.parse(content) as Record<string, string | number>;
    const result: Partial<EstimateAnswers> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (value === undefined || value === null || value === '') continue;
      if (isFieldAnswered(currentAnswers, key)) continue;
      result[key] = value;
    }

    return result;
  } catch {
    return {};
  }
}

export async function extractAnswersFromMessage(
  message: string,
  entryModuleId: EstimateModuleId,
  currentAnswers: EstimateAnswers,
  activeFieldId?: string,
  fieldOptions?: string[],
): Promise<EstimateAnswers> {
  let merged = { ...currentAnswers };

  if (activeFieldId && fieldOptions) {
    const matched = matchOptionValue(message, fieldOptions);
    if (matched) {
      merged = { ...merged, [activeFieldId]: matched };
    } else if (activeFieldId === 'projectCategory' || activeFieldId === 'propertyPurpose') {
      merged = applyPropertyPurposeAnswer(merged, message);
      const cat = normalizeProjectCategory(message);
      if (cat) merged = { ...merged, projectCategory: cat };
    } else if (activeFieldId === 'carpetArea') {
      const area = extractArea(message) ?? Number(message.replace(/\D/g, ''));
      if (Number.isFinite(area) && area > 0) merged = { ...merged, carpetArea: area };
      else merged = { ...merged, [activeFieldId]: message };
    } else {
      merged = { ...merged, [activeFieldId]: message };
    }
  }

  const regexExtracted = extractFromMessageRegex(message, entryModuleId, merged);
  merged = { ...merged, ...regexExtracted };

  const aiExtracted = await extractFromMessageAI(message, entryModuleId, merged);
  merged = { ...merged, ...aiExtracted };

  if (merged.projectCategory) {
    const cat = normalizeProjectCategory(String(merged.projectCategory));
    if (cat) merged = { ...merged, projectCategory: cat };
  }
  if (merged.propertyPurpose) {
    merged = applyPropertyPurposeAnswer(merged, String(merged.propertyPurpose));
  }

  if (merged.bedrooms && !merged.projectType) {
    merged.projectType = merged.projectType || 'Home Interior';
  }

  if (merged.propertyType && !merged.bedrooms && String(merged.propertyType).includes('BHK')) {
    merged.bedrooms = String(merged.propertyType);
  }

  return merged;
}
