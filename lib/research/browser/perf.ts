/** Lightweight step timings for Browser Worker latency profiling. */
export function researchPerfNow(): number {
  return performance.now();
}

export function researchPerfLog(
  step: string,
  startedAt: number,
  fields: Record<string, unknown> = {},
) {
  const ms = Math.round(performance.now() - startedAt);
  console.info(
    JSON.stringify({
      scope: 'research-perf',
      step,
      ms,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
  return ms;
}
