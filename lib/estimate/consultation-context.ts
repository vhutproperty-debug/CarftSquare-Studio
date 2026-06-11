import type { ConversationMessage, EstimateAnswers, EstimateModuleId } from './types';

export const AI_CONSULTATION_CONTEXT_KEY = 'css-ai-consultation-context';
export const OPEN_DESIGNER_CALLBACK_EVENT = 'css:open-designer-callback';

export interface AiConsultationContext {
  moduleId: EstimateModuleId;
  activeModuleId?: EstimateModuleId;
  answers: EstimateAnswers;
  conversation: ConversationMessage[];
  phase?: string;
  projectCategory?: string;
  consultationId?: string;
  updatedAt: string;
}

export function saveConsultationContext(context: Omit<AiConsultationContext, 'updatedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      AI_CONSULTATION_CONTEXT_KEY,
      JSON.stringify({ ...context, updatedAt: new Date().toISOString() }),
    );
  } catch {
    // Non-blocking
  }
}

export function readConsultationContext(): AiConsultationContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AI_CONSULTATION_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as AiConsultationContext) : null;
  } catch {
    return null;
  }
}

export function openDesignerCallbackModal(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OPEN_DESIGNER_CALLBACK_EVENT));
}
