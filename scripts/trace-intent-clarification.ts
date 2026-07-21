import fs from 'fs';
import path from 'path';

function loadEnvLocal() {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* optional */
  }
}

loadEnvLocal();

async function main() {
  const { understandResearchIntent } = await import('../lib/research/ai/intent');
  const samples = [
    'Find 2 BHK rentals in Auris Serenity',
    'Find 2 BHK rentals in Oberoi Sky City',
    'hello',
    '2bhk',
    'research mumbai',
  ];
  for (const s of samples) {
    const i = understandResearchIntent(s);
    console.log(
      JSON.stringify({
        s,
        needsClarification: i.needsClarification,
        clarification: i.clarificationQuestion,
        project: i.criteriaDelta.project,
        locality: i.criteriaDelta.locality,
        bhk: i.criteriaDelta.bhk,
        interpretedAs: i.interpretedAs,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
