export type EstimateModuleId =
  | 'home-interior'
  | 'rental-furnishing'
  | 'modular-kitchen'
  | 'wardrobe'
  | 'office-interior'
  | 'commercial-interior';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'site_visit'
  | 'negotiation'
  | 'won'
  | 'lost';

export type PackageTier = 'economy' | 'standard' | 'premium' | 'luxury';

export type PropertyPurpose = 'Own Residence' | 'Rental Furnishing';

export type PricingMode = 'fixed' | 'per_sqft';

export interface ConversationMessage {
  role: 'assistant' | 'user';
  content: string;
  timestamp: string;
}

export interface EstimateAnswers {
  [key: string]: string | number | boolean | string[] | undefined;
}

export interface QuotationAddon {
  id: string;
  name: string;
  enabled: boolean;
  pricingMode: PricingMode;
  fixedPrice: number;
  perSqftPrice: number;
  category: string;
}

export interface QuotationMaterial {
  id: string;
  name: string;
  enabled: boolean;
  multiplier: number;
  tier: PackageTier;
}

export interface QuotationPackage {
  id: PackageTier;
  name: string;
  enabled: boolean;
  baseMultiplier: number;
  description: string;
}

export interface CityMultiplier {
  id: string;
  name: string;
  multiplier: number;
  enabled: boolean;
}

export interface DiscountRule {
  id: string;
  name: string;
  enabled: boolean;
  percentOff: number;
  minArea?: number;
  maxArea?: number;
  packageIds?: PackageTier[];
}

export interface ModulePricingConfig {
  key: string;
  moduleId: EstimateModuleId;
  services: Array<{
    id: string;
    title: string;
    baseRate: number;
    active: boolean;
  }>;
  packages: QuotationPackage[];
  materials: QuotationMaterial[];
  addons: QuotationAddon[];
  cities: CityMultiplier[];
  discountRules: DiscountRule[];
  minProjectCost: number;
  maxProjectCost: number;
  timelineDaysPer100Sqft: number;
  updatedAt: string | null;
}

export interface PricingResult {
  estimateLow: number;
  estimateHigh: number;
  formattedRange: string;
  recommendedPackage: PackageTier;
  packageName: string;
  materialRecommendation: string;
  styleRecommendation: string;
  recommendedAddons: string[];
  timelineWeeks: string;
  timelineDays: number;
  aiSummary: ProjectSummary;
}

export interface ProjectSummary {
  projectType: string;
  area: string;
  lifestyle: string;
  budget: string;
  priority: string;
  packageRecommendation: string;
  styleRecommendation: string;
  materialRecommendation: string;
  timeline: string;
  propertyPurpose?: PropertyPurpose | null;
}

export interface QuotationQuote {
  id: string;
  quoteNumber: string;
  moduleId: EstimateModuleId;
  propertyPurpose: PropertyPurpose | null;
  leadSource: string;
  campaignName: string;
  landingPage: string;
  answers: EstimateAnswers;
  conversation: ConversationMessage[];
  aiSummary: ProjectSummary;
  pricing: PricingResult;
  adjustmentHistory: Array<{
    action: string;
    explanation: string;
    at: string;
  }>;
  customer?: {
    name: string;
    phone: string;
    whatsapp: string;
    email: string;
  };
  pdfStored: boolean;
  pdfPath?: string;
  status: LeadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationLead extends QuotationQuote {
  projectType: string;
  area: number;
  budget: string;
}

export type QuickAdjustmentAction =
  | 'reduce_10'
  | 'reduce_20'
  | 'upgrade_premium'
  | 'upgrade_luxury'
  | 'maximize_storage'
  | 'luxury_aesthetics'
  | 'rental_friendly'
  | 'airbnb_ready';
