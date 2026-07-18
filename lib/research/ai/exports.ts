import type { ResearchReport, ResearchScoredListing } from '@/lib/research/types';

function escapeCsv(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function listingsToCsv(
  listings: ResearchScoredListing[],
  meta?: { sessionId?: string; generatedAt?: string },
): string {
  const header = [
    'rank',
    'id',
    'title',
    'project',
    'portal',
    'portals',
    'bhk',
    'rent',
    'salePrice',
    'carpetArea',
    'rentPerSqft',
    'furnishing',
    'facing',
    'listingSource',
    'relevanceScore',
    'explanation',
    'url',
    'sessionId',
    'exportedAt',
  ];
  const exportedAt = meta?.generatedAt || new Date().toISOString();
  const rows = listings.map((l, i) => [
    i + 1,
    l.id,
    l.title,
    l.projectName,
    l.portal,
    (l.portalRefs || []).map((p) => p.portal).join('|'),
    l.bhk,
    l.rent,
    l.salePrice,
    l.carpetArea,
    l.rentPerSqft,
    l.furnishing,
    l.facing,
    l.listingSource,
    l.relevanceScore,
    l.explanation,
    l.url,
    meta?.sessionId,
    exportedAt,
  ]);
  return [header, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
}

/** SpreadsheetML Excel-compatible workbook (opens in Excel / LibreOffice). */
export function listingsToExcelXml(
  listings: ResearchScoredListing[],
  meta?: { sessionId?: string; title?: string },
): string {
  const headers = [
    'Rank',
    'Title',
    'Project',
    'Portals',
    'BHK',
    'Price',
    'Carpet',
    'Rent/sqft',
    'Furnishing',
    'Facing',
    'Score',
    'Explanation',
    'URL',
  ];
  const rowsXml = listings
    .map((l, i) => {
      const cells = [
        i + 1,
        l.title || '',
        l.projectName || '',
        (l.portalRefs || []).map((p) => p.portal).join(', ') || l.portal,
        l.bhk ?? '',
        l.rent ?? l.salePrice ?? '',
        l.carpetArea ?? '',
        l.rentPerSqft ?? '',
        l.furnishing || '',
        l.facing || '',
        l.relevanceScore,
        l.explanation || '',
        l.url || '',
      ];
      return `<Row>${cells
        .map((c) =>
          typeof c === 'number'
            ? `<Cell><Data ss:Type="Number">${c}</Data></Cell>`
            : `<Cell><Data ss:Type="String">${escapeXml(String(c))}</Data></Cell>`,
        )
        .join('')}</Row>`;
    })
    .join('');

  const headerRow = `<Row>${headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join('')}</Row>`;

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Listings">
  <Table>
   ${headerRow}
   ${rowsXml}
  </Table>
 </Worksheet>
 <Worksheet ss:Name="Meta">
  <Table>
   <Row><Cell><Data ss:Type="String">Session</Data></Cell><Cell><Data ss:Type="String">${escapeXml(meta?.sessionId || '')}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">Title</Data></Cell><Cell><Data ss:Type="String">${escapeXml(meta?.title || '')}</Data></Cell></Row>
   <Row><Cell><Data ss:Type="String">ExportedAt</Data></Cell><Cell><Data ss:Type="String">${escapeXml(new Date().toISOString())}</Data></Cell></Row>
  </Table>
 </Worksheet>
</Workbook>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapePdfText(value = ''): string {
  return String(value).replace(/[₹]/g, 'Rs.').replace(/[\\()]/g, '\\$&').replace(/[\r\n]+/g, ' ');
}

/** Lightweight multi-page-ish PDF report (single page stream, truncated safely). */
export function createResearchReportPdf(report: ResearchReport): Buffer {
  const lines = [
    'Prop/Research — Client Research Report',
    `Generated: ${report.generatedAt}`,
    `Confidence: ${report.researchConfidence}/100`,
    '',
    'Executive Summary',
    report.executiveSummary,
    '',
    'Search Strategy',
    report.searchStrategy,
    '',
    `Portals: ${report.portalsSearched.join(', ') || 'none'}`,
    `Listings found: ${report.listingsFound} | Duplicates removed: ${report.duplicatesRemoved}`,
    '',
    'Top Matches',
    ...report.topMatches.slice(0, 5).flatMap((l, i) => [
      `${i + 1}. ${l.title || 'Listing'} | score ${l.relevanceScore}`,
      l.explanation,
    ]),
    '',
    'Observations',
    ...report.observations,
    '',
    'Market Insights',
    `Avg rent: ${report.marketInsights.averageAskingRent ?? 'n/a'}`,
    `Range: ${report.marketInsights.minAskingRent ?? 'n/a'} - ${report.marketInsights.maxAskingRent ?? 'n/a'}`,
    `Duplicate % (multi-portal): ${report.marketInsights.duplicatePercentage}`,
    ...report.marketInsights.notes,
    '',
    'Recommended Next Steps',
    ...report.recommendedNextSteps,
    '',
    'Warnings',
    ...(report.warnings.length ? report.warnings : ['None']),
  ];

  const contentLines = [
    'BT',
    '/F1 14 Tf',
    '40 800 Td',
    `(${escapePdfText('CraftSquare Prop/Research')}) Tj`,
    '/F1 9 Tf',
  ];
  let yOffset = 0;
  for (const line of lines) {
    yOffset += 12;
    if (yOffset > 740) break;
    contentLines.push('0 -12 Td', `(${escapePdfText(line).slice(0, 110)}) Tj`);
  }
  contentLines.push('ET');
  const content = contentLines.join('\n');

  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
  );
  objects.push(`4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream endobj`);
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj');

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
}
