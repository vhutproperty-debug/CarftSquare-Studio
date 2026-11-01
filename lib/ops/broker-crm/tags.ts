const LOCALITIES: Array<{ match: string; label: string }> = [
  { match: 'mumbai central', label: 'Mumbai Central' },
  { match: 'vile parle', label: 'Vile Parle' },
  { match: 'lower parel', label: 'Lower Parel' },
  { match: 'mira road', label: 'Mira Road' },
  { match: 'navi mumbai', label: 'Navi Mumbai' },
  { match: 'lokhandwala', label: 'Lokhandwala' },
  { match: 'jogeshwari', label: 'Jogeshwari' },
  { match: 'santacruz', label: 'Santacruz' },
  { match: 'kandivali', label: 'Kandivali' },
  { match: 'kandivli', label: 'Kandivali' },
  { match: 'borivali', label: 'Borivali' },
  { match: 'goregaon', label: 'Goregaon' },
  { match: 'andheri', label: 'Andheri' },
  { match: 'malad', label: 'Malad' },
  { match: 'dahisar', label: 'Dahisar' },
  { match: 'bandra', label: 'Bandra' },
  { match: 'versova', label: 'Versova' },
  { match: 'chembur', label: 'Chembur' },
  { match: 'ghatkopar', label: 'Ghatkopar' },
  { match: 'mulund', label: 'Mulund' },
  { match: 'powai', label: 'Powai' },
  { match: 'worli', label: 'Worli' },
  { match: 'dadar', label: 'Dadar' },
  { match: 'thane', label: 'Thane' },
  { match: 'juhu', label: 'Juhu' },
  { match: 'khar', label: 'Khar' },
];

const PROJECTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /ekta\s*world/i, label: 'Ekta World' },
  { pattern: /neelkanth/i, label: 'Neelkanth' },
  { pattern: /kalpataru\s*radiance/i, label: 'Kalpataru Radiance' },
  { pattern: /ekta\s*tripolis/i, label: 'Ekta Tripolis' },
  { pattern: /oberoi\s*sky\s*city/i, label: 'Oberoi Sky City' },
  { pattern: /lodha\s*raj\s*infinia/i, label: 'Lodha Raj Infinia' },
  { pattern: /omkar\s*alta\s*monte/i, label: 'Omkar Alta Monte' },
];

const LOCALITY_SCAN = [...LOCALITIES].sort((a, b) => b.match.length - a.match.length);

export function uniqueLabels(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export function inferTagsFromGroups(groups: string[]): { areas: string[]; projects: string[] } {
  const areas: string[] = [];
  const projects: string[] = [];
  const areaSeen = new Set<string>();
  const projectSeen = new Set<string>();
  for (const group of groups) {
    const hay = group.toLowerCase();
    for (const locality of LOCALITY_SCAN) {
      if (!hay.includes(locality.match) || areaSeen.has(locality.label)) continue;
      areaSeen.add(locality.label);
      areas.push(locality.label);
    }
    for (const project of PROJECTS) {
      if (!project.pattern.test(group) || projectSeen.has(project.label)) continue;
      projectSeen.add(project.label);
      projects.push(project.label);
    }
  }
  return { areas, projects };
}

export function splitGroupList(value: string): string[] {
  return uniqueLabels(String(value || '').split(/[;\n|]+/));
}

export function brokerAreaLabels(record: { derivedAreas?: string[]; areaTags?: string[] }): string[] {
  return uniqueLabels([...(record.derivedAreas || []), ...(record.areaTags || [])]);
}

export function brokerProjectLabels(record: { derivedProjects?: string[]; projectTags?: string[] }): string[] {
  return uniqueLabels([...(record.derivedProjects || []), ...(record.projectTags || [])]);
}
