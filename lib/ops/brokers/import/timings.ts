/** Stage timing for broker import profiling. */

export type ImportTimingStage =
  | 'upload'
  | 'fileRead'
  | 'validation'
  | 'whatsappParse'
  | 'messageExtraction'
  | 'normalization'
  | 'deduplication'
  | 'mongoQueries'
  | 'bulkWrites'
  | 'responseGeneration'
  | 'total';

export type ImportTimings = Partial<Record<ImportTimingStage, number>>;

export class StageTimer {
  private marks = new Map<string, number>();
  private accumulated: ImportTimings = {};
  readonly startedAt = Date.now();

  start(stage: ImportTimingStage): void {
    this.marks.set(stage, Date.now());
  }

  end(stage: ImportTimingStage): number {
    const t0 = this.marks.get(stage);
    if (t0 == null) return 0;
    const ms = Date.now() - t0;
    this.accumulated[stage] = (this.accumulated[stage] || 0) + ms;
    this.marks.delete(stage);
    return ms;
  }

  /** Time an async function into a stage. */
  async time<T>(stage: ImportTimingStage, fn: () => Promise<T>): Promise<T> {
    this.start(stage);
    try {
      return await fn();
    } finally {
      this.end(stage);
    }
  }

  /** Time a sync function into a stage. */
  timeSync<T>(stage: ImportTimingStage, fn: () => T): T {
    this.start(stage);
    try {
      return fn();
    } finally {
      this.end(stage);
    }
  }

  add(stage: ImportTimingStage, ms: number): void {
    if (ms <= 0) return;
    this.accumulated[stage] = (this.accumulated[stage] || 0) + ms;
  }

  snapshot(): ImportTimings {
    return {
      ...this.accumulated,
      total: Date.now() - this.startedAt,
    };
  }
}
