import fs from 'fs';
import path from 'path';
import { buildMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { buildSatelliteWebPageJsonLd } from '@/lib/satellite-elegance/jsonld';
import { SATELLITE_LANDING_PATH, SATELLITE_TOWER_IMAGE } from '@/lib/satellite-elegance/constants';
import JsonLd from '@/components/JsonLd';
import SatelliteEleganceClient from '@/components/satellite-elegance/SatelliteEleganceClient';

const PAGE_TITLE = 'Satellite Elegance Interior Design | CraftSquare Studio';
const PAGE_DESCRIPTION =
  'Getting possession at Satellite Elegance? Plan your complete home interiors with CraftSquare Studio. Get a free design consultation, site visit and measurement.';

export const metadata = buildMetadata({
  seo: {
    metaTitle: PAGE_TITLE,
    metaDescription: PAGE_DESCRIPTION,
    keywords: [
      'Satellite Elegance interiors',
      'Satellite Elegance home interiors Goregaon',
      'Satellite Elegance possession interiors',
      'CraftSquare Studio Satellite Elegance',
    ],
  },
  path: SATELLITE_LANDING_PATH,
  fallbackTitle: PAGE_TITLE,
  fallbackDescription: PAGE_DESCRIPTION,
  robots: { index: true, follow: true },
});

function towerImageExists(): boolean {
  try {
    const filePath = path.join(process.cwd(), 'public', SATELLITE_TOWER_IMAGE.replace(/^\//, ''));
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export default function SatelliteElegancePage() {
  const hasTowerImage = towerImageExists();
  const dateModified = new Date().toISOString().split('T')[0];

  return (
    <>
      <JsonLd
        data={buildSatelliteWebPageJsonLd({
          name: 'Satellite Elegance Interior Design',
          description: PAGE_DESCRIPTION,
          path: SATELLITE_LANDING_PATH,
          dateModified,
        })}
      />
      <JsonLd data={pageBreadcrumb('Satellite Elegance', SATELLITE_LANDING_PATH)} />
      <SatelliteEleganceClient hasTowerImage={hasTowerImage} />
    </>
  );
}
