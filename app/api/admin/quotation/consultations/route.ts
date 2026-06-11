import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth/require-admin-api';
import { getDatabase, listConsultationDrafts } from '@/lib/estimate/store';
import type { ConsultationDraft } from '@/lib/estimate/types';

export async function GET(request: Request) {
  const admin = await requireAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: 'Admin authentication required.' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim().toLowerCase() || '';
  const unconvertedOnly = searchParams.get('unconverted') !== 'false';

  const db = await getDatabase();
  let consultations = await listConsultationDrafts(db, 500);

  if (unconvertedOnly) {
    consultations = consultations.filter((c) => !c.convertedQuoteId);
  }

  if (q) {
    consultations = consultations.filter((draft) => {
      const haystack = [
        draft.id,
        draft.projectCategory,
        draft.moduleId,
        draft.leadSource,
        draft.landingPage,
        draft.aiSummary?.customerRequirementSummary,
        draft.aiSummary?.budget,
        draft.timeline,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return NextResponse.json({ consultations });
}
