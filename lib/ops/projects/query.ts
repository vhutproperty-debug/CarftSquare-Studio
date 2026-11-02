import { matchesBhk, overlapsPriceBand } from '@/lib/ops/projects/format';
import type {
  DeveloperListQuery,
  DeveloperProject,
  ResaleListQuery,
  ResaleProject,
  ResaleUnit,
} from '@/lib/ops/projects/types';

function includes(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

export function filterDeveloperProjects(projects: DeveloperProject[], query: DeveloperListQuery): DeveloperProject[] {
  return projects.filter((project) => {
    if (query.locality && project.locality !== query.locality) return false;
    if (query.developer && project.developer !== query.developer) return false;
    if (query.status && project.status !== query.status) return false;
    if (!matchesBhk(project.bhk, query.bhk)) return false;
    if (!overlapsPriceBand(project.priceMinCrore, project.priceMaxCrore, query.priceBand)) return false;
    if (query.q) {
      const hay = [project.name, project.developer, project.locality, project.address, project.maharera, project.configLabel].join(' ');
      if (!includes(hay, query.q)) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function developerFilterOptions(projects: DeveloperProject[]) {
  const bhks = new Set<number>();
  projects.forEach((project) => project.bhk.forEach((bhk) => bhks.add(bhk)));
  return {
    localities: unique(projects.map((project) => project.locality)),
    developers: unique(projects.map((project) => project.developer)),
    bhks: [...bhks].sort((a, b) => a - b),
  };
}

export function filterResaleProjects(projects: ResaleProject[], query: ResaleListQuery): ResaleProject[] {
  return projects.filter((project) => {
    if (query.locality && project.locality !== query.locality) return false;
    if (query.project && project.slug !== query.project) return false;
    if (query.q) {
      const hay = [project.name, project.developer, project.locality, project.maharera].join(' ');
      if (!includes(hay, query.q)) return false;
    }
    return true;
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function filterResaleUnits(
  units: ResaleUnit[],
  query: ResaleListQuery,
  projects: ResaleProject[] = [],
  includePrivate = false,
): ResaleUnit[] {
  const localities = query.locality
    ? new Set(projects.filter((project) => project.locality === query.locality).map((project) => project.slug))
    : null;
  return units.filter((unit) => {
    if (localities && !localities.has(unit.projectSlug)) return false;
    if (query.project && unit.projectSlug !== query.project) return false;
    if (query.tower && unit.tower !== query.tower) return false;
    if (query.status && unit.status !== query.status) return false;
    if (query.floorBand && unit.floorBand !== query.floorBand) return false;
    if (query.listingType && unit.listingType !== query.listingType) return false;
    if (query.bhk && unit.bhk !== Number(query.bhk)) return false;
    if (!overlapsPriceBand(unit.askingPriceCrore, unit.askingPriceCrore, query.priceBand)) return false;
    if (query.q) {
      const parts = [unit.projectName, unit.tower, unit.floorBand, unit.askingPriceLabel, unit.notes];
      if (includePrivate) parts.push(unit.unitNumber, unit.owner.name, unit.owner.phone, unit.owner.email);
      if (!includes(parts.join(' '), query.q)) return false;
    }
    return true;
  }).sort((a, b) => a.projectName.localeCompare(b.projectName) || a.tower.localeCompare(b.tower));
}

export function resaleFilterOptions(projects: ResaleProject[], units: ResaleUnit[]) {
  const bhks = new Set<number>();
  units.forEach((unit) => {
    if (unit.bhk != null) bhks.add(unit.bhk);
  });
  return {
    localities: unique(projects.map((project) => project.locality)),
    projects: projects.map((project) => ({ slug: project.slug, name: project.name })).sort((a, b) => a.name.localeCompare(b.name)),
    towers: unique(units.map((unit) => unit.tower)),
    floorBands: unique(units.map((unit) => unit.floorBand)),
    bhks: [...bhks].sort((a, b) => a - b),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
