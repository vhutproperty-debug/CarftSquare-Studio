import type {
  EstimateAnswers,
  EstimateModuleId,
  ModulePricingConfig,
  PackageTier,
  PricingResult,
  ProjectSummary,
  QuickAdjustmentAction,
} from './types';
import { DEFAULT_MODULE_PRICING } from './defaults';
import { budgetToPackage, cityToMultiplierId, formatBudgetRange, parseArea } from './format';

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function mergeModulePricing(
  stored: Partial<ModulePricingConfig> | null,
  moduleId: EstimateModuleId,
): ModulePricingConfig {
  const defaults = DEFAULT_MODULE_PRICING[moduleId];
  if (!stored) return defaults;
  return {
    ...defaults,
    ...stored,
    packages: stored.packages?.length ? stored.packages : defaults.packages,
    materials: stored.materials?.length ? stored.materials : defaults.materials,
    addons: stored.addons?.length ? stored.addons : defaults.addons,
    cities: stored.cities?.length ? stored.cities : defaults.cities,
    discountRules: stored.discountRules?.length ? stored.discountRules : defaults.discountRules,
    services: stored.services?.length ? stored.services : defaults.services,
  };
}

function resolvePackage(answers: EstimateAnswers, config: ModulePricingConfig, override?: PackageTier): PackageTier {
  if (override) return override;
  const furnishing = String(answers.furnishingLevel || '');
  if (/luxury/i.test(furnishing)) return 'luxury';
  if (/premium|airbnb/i.test(furnishing)) return 'premium';
  if (/basic|essential/i.test(furnishing)) return 'economy';
  return budgetToPackage(String(answers.budget || ''));
}

function addonCost(answers: EstimateAnswers, config: ModulePricingConfig, area: number): { total: number; names: string[] } {
  const names: string[] = [];
  let total = 0;
  const map: Record<string, boolean> = {
    'false-ceiling': /full|living|selected/i.test(String(answers.falseCeiling || '')),
    lighting: /yes|basic/i.test(String(answers.lighting || '')),
    furniture: !/no/i.test(String(answers.furniture || answers.furnitureRequired || '')),
    'smart-home': /yes|future/i.test(String(answers.smartHome || '')),
    appliances: !/no|none/i.test(String(answers.appliances || answers.appliancesRequired || '')),
    curtains: !/no/i.test(String(answers.curtains || '')),
    beds: !/no/i.test(String(answers.beds || answers.mattress || '')),
    mattress: !/no/i.test(String(answers.mattress || answers.beds || '')),
    wardrobes: !/no/i.test(String(answers.wardrobes || '')),
    dining: !/no/i.test(String(answers.dining || '')),
    sofa: !/no/i.test(String(answers.sofa || '')),
    'tv-unit': !/no/i.test(String(answers.tvUnit || '')),
    'study-table': /yes/i.test(String(answers.studyTable || '')),
  };

  for (const addon of config.addons) {
    if (!addon.enabled || !map[addon.id]) continue;
    names.push(addon.name);
    total += addon.pricingMode === 'per_sqft' ? addon.perSqftPrice * area : addon.fixedPrice;
  }
  return { total, names };
}

export function buildProjectSummary(
  answers: EstimateAnswers,
  pkgName: string,
  material: string,
  style: string,
  timeline: string,
  propertyPurpose: ProjectSummary['propertyPurpose'] = null,
): ProjectSummary {
  return {
    projectType: String(answers.projectType || answers.propertyType || answers.rentalType || 'Interior Project'),
    area: answers.carpetArea ? `${answers.carpetArea} sq.ft` : 'To be confirmed',
    lifestyle: String(answers.familySize || answers.tenantType || 'Modern urban living'),
    budget: String(answers.budget || answers.targetMonthlyRent || 'Flexible'),
    priority: String(answers.storagePriority || answers.furnishingLevel || 'Balanced design & function'),
    packageRecommendation: pkgName,
    styleRecommendation: style,
    materialRecommendation: material,
    timeline,
    propertyPurpose,
  };
}

export function calculateQuotation(
  moduleId: EstimateModuleId,
  answers: EstimateAnswers,
  config: ModulePricingConfig,
  options: { packageOverride?: PackageTier; adjustment?: QuickAdjustmentAction } = {},
): PricingResult {
  const area = parseArea(answers.carpetArea);
  const cityId = cityToMultiplierId(String(answers.city || 'Mumbai'));
  const city = config.cities.find((c) => c.id === cityId && c.enabled) || config.cities[0];
  const pkgTier = resolvePackage(answers, config, options.packageOverride);
  const pkg = config.packages.find((p) => p.id === pkgTier && p.enabled) || config.packages[1];
  const service = config.services.find((s) => s.active) || config.services[0];
  const material =
    config.materials.find((m) => m.tier === pkgTier && m.enabled) ||
    config.materials.find((m) => m.enabled) ||
    config.materials[0];

  let packageMultiplier = pkg.baseMultiplier * (material?.multiplier || 1) * (city?.multiplier || 1);
  const { total: addonTotal, names: addonNames } = addonCost(answers, config, area);

  if (options.adjustment === 'reduce_10') packageMultiplier *= 0.9;
  if (options.adjustment === 'reduce_20') packageMultiplier *= 0.8;
  if (options.adjustment === 'upgrade_premium') packageMultiplier *= 1.15;
  if (options.adjustment === 'upgrade_luxury') packageMultiplier *= 1.35;
  if (options.adjustment === 'maximize_storage') packageMultiplier *= 1.08;
  if (options.adjustment === 'luxury_aesthetics') packageMultiplier *= 1.2;
  if (options.adjustment === 'rental_friendly') packageMultiplier *= 0.92;
  if (options.adjustment === 'airbnb_ready') packageMultiplier *= 1.1;

  let base = area * service.baseRate * packageMultiplier + addonTotal;

  for (const rule of config.discountRules) {
    if (!rule.enabled) continue;
    if (rule.minArea && area < rule.minArea) continue;
    if (rule.maxArea && area > rule.maxArea) continue;
    if (rule.packageIds && !rule.packageIds.includes(pkgTier)) continue;
    base *= 1 - rule.percentOff / 100;
  }

  base = clamp(base, config.minProjectCost, config.maxProjectCost);
  const low = roundToNearest(base * 0.94, 5000);
  const high = roundToNearest(base * 1.06, 5000);
  const days = Math.max(14, Math.ceil((area / 100) * config.timelineDaysPer100Sqft));
  const weeks = `${Math.ceil(days / 7)}–${Math.ceil(days / 7) + 2} weeks`;
  const style = String(answers.designStyle || answers.furnishingLevel || 'Contemporary elegance');

  const purpose =
    answers.propertyPurpose === 'Own Residence' || answers.propertyPurpose === 'Rental Furnishing'
      ? answers.propertyPurpose
      : null;
  const aiSummary = buildProjectSummary(answers, pkg.name, material.name, style, weeks, purpose);

  return {
    estimateLow: low,
    estimateHigh: high,
    formattedRange: formatBudgetRange(low, high),
    recommendedPackage: pkgTier,
    packageName: pkg.name,
    materialRecommendation: material.name,
    styleRecommendation: style,
    recommendedAddons: addonNames,
    timelineWeeks: weeks,
    timelineDays: days,
    aiSummary,
  };
}

export function getAdjustmentExplanation(action: QuickAdjustmentAction): string {
  const map: Record<QuickAdjustmentAction, string> = {
    reduce_10: 'We optimised material selections and scope to reduce your estimate by approximately 10% while preserving core design quality.',
    reduce_20: 'We applied value-engineering across finishes and add-ons to bring the estimate down by roughly 20%.',
    upgrade_premium: 'We upgraded your package to Premium with superior materials, hardware and designer detailing.',
    upgrade_luxury: 'We elevated your quotation to Luxury with bespoke finishes and premium imported materials.',
    maximize_storage: 'We prioritised custom storage, loft solutions and wardrobe optimisation — ideal for compact Mumbai homes.',
    luxury_aesthetics: 'We enhanced aesthetic detailing with premium veneers, accent lighting and designer finishes.',
    rental_friendly: 'We tailored the scope for durable, tenant-friendly furnishings with faster turnaround.',
    airbnb_ready: 'We configured a guest-ready, Instagram-worthy furnishing package optimised for short-stay rentals.',
  };
  return map[action];
}
