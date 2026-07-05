import fs from 'fs';
import path from 'path';
import { buildMetadata } from '@/lib/seo/metadata';
import { pageBreadcrumb } from '@/lib/seo/breadcrumbs';
import { buildAurisWebPageJsonLd } from '@/lib/auris-serenity/jsonld';
import { AURIS_LANDING_PATH, AURIS_TOWER_IMAGE } from '@/lib/auris-serenity/constants';
import JsonLd from '@/components/JsonLd';
import AurisSerenityClient from '@/components/auris-serenity/AurisSerenityClient';

const PAGE_TITLE = 'Auris Serenity Interiors & Rental-Ready Solutions | CraftSquare Studio';
const PAGE_DESCRIPTION =
  'Interior, rental-ready and complete home furnishing solutions for Auris Serenity homeowners. Choose your requirement and connect with CraftSquare Studio on WhatsApp.';

export const metadata = buildMetadata({
  seo: {
    metaTitle: PAGE_TITLE,
    metaDescription: PAGE_DESCRIPTION,
    keywords: [
      'Auris Serenity interiors',
      'Auris Serenity rental furnishing',
      'Auris Serenity home furnishing Mumbai',
      'CraftSquare Studio Auris Serenity',
    ],
  },
  path: AURIS_LANDING_PATH,
  fallbackTitle: PAGE_TITLE,
  fallbackDescription: PAGE_DESCRIPTION,
  robots: { index: true, follow: true },
});

function towerImageExists(): boolean {
  try {
    const filePath = path.join(process.cwd(), 'public', AURIS_TOWER_IMAGE.replace(/^\//, ''));
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export default function AurisSerenityPage() {
  const hasTowerImage = towerImageExists();
  const dateModified = new Date().toISOString().split('T')[0];

  return (
    <>
      <JsonLd
        data={buildAurisWebPageJsonLd({
          name: 'Auris Serenity Interiors & Rental-Ready Solutions',
          description: PAGE_DESCRIPTION,
          path: AURIS_LANDING_PATH,
          dateModified,
        })}
      />
      <JsonLd data={pageBreadcrumb('Auris Serenity', AURIS_LANDING_PATH)} />
      <AurisSerenityClient hasTowerImage={hasTowerImage} />
    </>
  );
}
