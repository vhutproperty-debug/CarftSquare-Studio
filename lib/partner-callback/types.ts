export type PartnerCallbackStatus = 'pending' | 'contacted' | 'closed';

export interface PartnerCallbackRequest {
  id: string;
  name?: string;
  mobile: string;
  source: string;
  status: PartnerCallbackStatus;
  createdAt: string;
  updatedAt?: string;
}
