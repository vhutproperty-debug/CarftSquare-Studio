import { RESEARCH_BROWSER_CONFIG } from '@/lib/research/browser/config';

export class RetryManager {
  constructor(private readonly maxRetries = RESEARCH_BROWSER_CONFIG.maxRetries) {}

  async run<T>(fn: (attempt: number) => Promise<T>, label = 'operation'): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      try {
        return await fn(attempt);
      } catch (error) {
        lastError = error;
        if (attempt > this.maxRetries) break;
        const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
        console.warn(
          `[research-browser] retry ${attempt}/${this.maxRetries} for ${label}`,
          error instanceof Error ? error.message : error,
        );
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
  }
}
