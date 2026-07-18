/**
 * Extracts structured property data from portal pages or documents.
 * Phase 1: interface contract only.
 */
export interface ExtractionEngine {
  readonly name: 'ExtractionEngine';
  extract(input: {
    sourceUrl?: string;
    html?: string;
    text?: string;
  }): Promise<Record<string, unknown>>;
}
