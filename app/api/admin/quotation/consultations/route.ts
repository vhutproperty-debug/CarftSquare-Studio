import { NextResponse } from 'next/server';
import { authorizeRequest } from '@/lib/auth/require-admin-api';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { PERMISSIONS } from '@/lib/auth/rbac/permissions';
import { getDatabase, listConsultationDrafts } from '@/lib/estimate/store';

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, { permission: PERMISSIONS.CUSTOMERS });
  const denied = authResultToResponse(auth);
  if (denied) return denied;

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
