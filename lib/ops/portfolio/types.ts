export const PORTFOLIO_COLLECTION = 'portfolio_owners';

export type PortfolioFlat = {
  project: string;
  tower: string;
  floor: string;
  flat: string;
};

export type PortfolioOwner = {
  id: string;
  name: string;
  phone_e164: string;
  email: string;
  priority: string;
  nri: boolean;
  company: boolean;
  broker: boolean;
  suspected_broker: boolean;
  projects: string[];
  flats: PortfolioFlat[];
  notes: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastUpdatedBy: string;
};

export type PublicPortfolioOwner = Omit<PortfolioOwner, 'phone_e164' | 'name'> & {
  name: string;
  phone_masked: string;
};
