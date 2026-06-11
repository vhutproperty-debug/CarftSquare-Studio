export type DesignerLeadStatus = 'new' | 'contacted' | 'meeting_scheduled' | 'won' | 'lost';

export type DesignerProjectType = 'Home' | 'Office' | 'Commercial' | 'Rental Property' | 'Other';

export interface DesignerAiContext {
  moduleId?: string;
  projectCategory?: string;
  phase?: string;
  consultationId?: string;
  answers?: Record<string, unknown>;
  conversation?: Array<{ role: string; content: string; timestamp: string }>;
}

export interface DesignerCallbackLead {
  id: string;
  name: string;
  phone: string;
  city: string;
  projectType: DesignerProjectType | '';
  message: string;
  preferredCallTime: string;
  source: 'Human Designer Request' | 'AI Chat Callback';
  landingPage: string;
  aiContext?: DesignerAiContext | null;
  status: DesignerLeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
