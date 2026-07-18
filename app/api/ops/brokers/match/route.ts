import { NextResponse } from 'next/server';
import { authResultToResponse } from '@/lib/auth/rbac/guard';
import { requireOpsViewAccess } from '@/lib/ops/auth';
import { matchDemandAgainstBrokerInventory } from '@/lib/ops/brokers/match-adapter';
import { publicOpsError } from '@/lib/ops/brokers/safe-error';
import { brokerMatchQuerySchema } from '@/lib/ops/brokers/schemas';

export async function GET(request: Request) {
  const auth = await requireOpsViewAccess(request);
  const denied = authResultToResponse(auth);
  if (denied) return denied;
  if (!auth.ok) return denied!;

  const { searchParams } = new URL(request.url);
  const parsed = brokerMatchQuerySchema.safeParse({
    demandKey: searchParams.get('demandKey') || undefined,
    demandSource: searchParams.get('demandSource') || undefined,
    demandSourceId: searchParams.get('demandSourceId') || undefined,
    inventoryId: searchParams.get('inventoryId') || undefined,
    limit: searchParams.get('limit') || 20,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    if (parsed.data.inventoryId) {
      return NextResponse.json({
        error: 'Use GET /api/ops/brokers/[id]?includeMatches=true for inventory→demand matches.',
      }, { status: 400 });
    }

    const hits = await matchDemandAgainstBrokerInventory({
      demandKey: parsed.data.demandKey,
      demandSource: parsed.data.demandSource,
      demandSourceId: parsed.data.demandSourceId,
      limit: parsed.data.limit,
    });

    return NextResponse.json({ items: hits });
  } catch (error) {
    console.error('[ops-brokers] match_failed', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: publicOpsError(error, 'Unable to match broker inventory.') },
      { status: 500 },
    );
  }
}
