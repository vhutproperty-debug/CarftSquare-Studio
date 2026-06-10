export type DesignerLeadStatus = 'new' | 'contacted' | 'meeting_scheduled' | 'won' | 'lost';

export type DesignerProjectType = 'Home' | 'Office' | 'Commercial' | 'Rental Property' | 'Other';

export interface DesignerCallbackLead {
  id: string;
  name: string;
  phone: string;
  city: string;
  projectType: DesignerProjectType | '';
  message: string;
  source: 'Human Designer Request';
  landingPage: string;
  status: DesignerLeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
