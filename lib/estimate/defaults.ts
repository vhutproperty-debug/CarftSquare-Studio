import type { EstimateModuleId, ModulePricingConfig } from './types';

const SHARED_PACKAGES = [
  { id: 'economy' as const, name: 'Essential', enabled: true, baseMultiplier: 0.82, description: 'Smart, functional interiors for practical living.' },
  { id: 'standard' as const, name: 'Signature', enabled: true, baseMultiplier: 1, description: 'Balanced design with quality materials and modular solutions.' },
  { id: 'premium' as const, name: 'Premium', enabled: true, baseMultiplier: 1.28, description: 'Elevated finishes, branded hardware and designer detailing.' },
  { id: 'luxury' as const, name: 'Luxury', enabled: true, baseMultiplier: 1.65, description: 'Bespoke luxury interiors with imported materials and artisan finishes.' },
];

const SHARED_MATERIALS = [
  { id: 'plywood', name: 'Plywood', enabled: true, multiplier: 1, tier: 'standard' as const },
  { id: 'marine-ply', name: 'Marine Ply', enabled: true, multiplier: 1.08, tier: 'premium' as const },
  { id: 'hdhmr', name: 'HDHMR', enabled: true, multiplier: 1.12, tier: 'premium' as const },
  { id: 'mdf', name: 'MDF', enabled: true, multiplier: 0.92, tier: 'economy' as const },
  { id: 'laminate', name: 'Laminate', enabled: true, multiplier: 1, tier: 'standard' as const },
  { id: 'pu', name: 'PU', enabled: true, multiplier: 1.22, tier: 'premium' as const },
  { id: 'acrylic', name: 'Acrylic', enabled: true, multiplier: 1.18, tier: 'premium' as const },
  { id: 'glass', name: 'Glass', enabled: true, multiplier: 1.15, tier: 'luxury' as const },
  { id: 'veneer', name: 'Veneer', enabled: true, multiplier: 1.35, tier: 'luxury' as const },
];

const INTERIOR_ADDONS = [
  { id: 'false-ceiling', name: 'False Ceiling', enabled: true, pricingMode: 'per_sqft' as const, fixedPrice: 0, perSqftPrice: 85, category: 'civil' },
  { id: 'lighting', name: 'Lighting Design', enabled: true, pricingMode: 'per_sqft' as const, fixedPrice: 0, perSqftPrice: 45, category: 'electrical' },
  { id: 'wallpaper', name: 'Wallpaper', enabled: true, pricingMode: 'per_sqft' as const, fixedPrice: 0, perSqftPrice: 55, category: 'decor' },
  { id: 'furniture', name: 'Furniture Package', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 185000, perSqftPrice: 0, category: 'furnishing' },
  { id: 'smart-home', name: 'Smart Home', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 95000, perSqftPrice: 0, category: 'technology' },
  { id: 'appliances', name: 'Appliances', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 125000, perSqftPrice: 0, category: 'furnishing' },
];

const RENTAL_ADDONS = [
  { id: 'curtains', name: 'Curtains & Blinds', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 28000, perSqftPrice: 0, category: 'soft-furnishing' },
  { id: 'beds', name: 'Beds & Mattresses', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 65000, perSqftPrice: 0, category: 'furniture' },
  { id: 'mattress', name: 'Mattresses', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 35000, perSqftPrice: 0, category: 'furniture' },
  { id: 'wardrobes', name: 'Wardrobes', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 45000, perSqftPrice: 0, category: 'furniture' },
  { id: 'dining', name: 'Dining Set', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 32000, perSqftPrice: 0, category: 'furniture' },
  { id: 'sofa', name: 'Sofa', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 48000, perSqftPrice: 0, category: 'furniture' },
  { id: 'tv-unit', name: 'TV Unit', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 22000, perSqftPrice: 0, category: 'furniture' },
  { id: 'study-table', name: 'Study Table', enabled: true, pricingMode: 'fixed' as const, fixedPrice: 18000, perSqftPrice: 0, category: 'furniture' },
];

const SHARED_CITIES = [
  { id: 'mumbai', name: 'Mumbai', multiplier: 1, enabled: true },
  { id: 'navi-mumbai', name: 'Navi Mumbai', multiplier: 0.96, enabled: true },
  { id: 'thane', name: 'Thane', multiplier: 0.94, enabled: true },
  { id: 'pune', name: 'Pune', multiplier: 0.9, enabled: true },
];

function buildInteriorConfig(moduleId: EstimateModuleId, serviceId: string, baseRate: number): ModulePricingConfig {
  return {
    key: `quotation_pricing_${moduleId}`,
    moduleId,
    services: [{ id: serviceId, title: serviceId, baseRate, active: true }],
    packages: SHARED_PACKAGES,
    materials: SHARED_MATERIALS,
    addons: moduleId === 'rental-furnishing' ? RENTAL_ADDONS : INTERIOR_ADDONS,
    cities: SHARED_CITIES,
    discountRules: [
      { id: 'large-project', name: 'Large Project Discount', enabled: true, percentOff: 5, minArea: 1200 },
      { id: 'rental-bundle', name: 'Rental Bundle Discount', enabled: true, percentOff: 8, packageIds: ['economy'] },
    ],
    minProjectCost: moduleId === 'rental-furnishing' ? 150000 : 350000,
    maxProjectCost: moduleId === 'rental-furnishing' ? 2500000 : 15000000,
    timelineDaysPer100Sqft: moduleId === 'rental-furnishing' ? 4 : 6,
    updatedAt: null,
  };
}

export const DEFAULT_MODULE_PRICING: Record<EstimateModuleId, ModulePricingConfig> = {
  'home-interior': buildInteriorConfig('home-interior', 'residential-interiors', 450),
  'rental-furnishing': buildInteriorConfig('rental-furnishing', 'rental-interiors', 280),
  'modular-kitchen': buildInteriorConfig('modular-kitchen', 'modular-kitchens', 1800),
  'wardrobe': buildInteriorConfig('wardrobe', 'modular-wardrobes', 650),
  'office-interior': buildInteriorConfig('office-interior', 'commercial-interiors', 550),
  'commercial-interior': buildInteriorConfig('commercial-interior', 'commercial-interiors', 580),
};

export const DISCLAIMER =
  'This is an AI-assisted preliminary estimate. Final quotation will be confirmed after site inspection and design discussion.';

export const WELCOME_MESSAGES: Record<EstimateModuleId, string> = {
  'home-interior':
    "Welcome to Craft Square Studio.\n\nI'm your AI Interior Consultant.\n\nI'll understand your requirements and generate an instant interior estimate and design recommendation in under 2 minutes.",
  'rental-furnishing':
    "Welcome to Craft Square Studio Rental Furnishing.\n\nI'm your AI Furnishing Consultant.\n\nI'll understand your rental property needs and generate a dedicated furnishing estimate tailored for investors and landlords.",
  'modular-kitchen':
    "Welcome to Craft Square Studio.\n\nI'm your AI Kitchen Consultant.\n\nLet's design your dream modular kitchen with an instant estimate.",
  'wardrobe':
    "Welcome to Craft Square Studio.\n\nI'm your AI Wardrobe Consultant.\n\nI'll help you plan custom storage with an instant estimate.",
  'office-interior':
    "Welcome to Craft Square Studio.\n\nI'm your AI Office Interior Consultant.",
  'commercial-interior':
    "Welcome to Craft Square Studio.\n\nI'm your AI Commercial Interior Consultant.",
};
