import { NextResponse } from 'next/server';
import { ProjectValidationError } from '@/lib/ops/projects/errors';

export function projectError(error: unknown, fallback: string) {
  if (error instanceof ProjectValidationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  console.error('[ops-projects]', error instanceof Error ? error.message : 'error');
  return NextResponse.json({ error: fallback }, { status: 500 });
}
