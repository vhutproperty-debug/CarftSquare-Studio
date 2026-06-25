export type PaintingLeadStatus =
  | 'new'
  | 'contacted'
  | 'site_visit_scheduled'
  | 'quoted'
  | 'won'
  | 'lost';

export interface PaintingLead {
  id: string;
  name: string;
  mobile: string;
  email: string;
  location: string;
  propertyType: string;
  apartmentSize: string;
  requirement: string;
  visitDate: string;
  budget: string;
  message: string;
  leadSource: string;
  status: PaintingLeadStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaintingGalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaintingTestimonial {
  id: string;
  name: string;
  location: string;
  rating: number;
  text: string;
  projectType: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
