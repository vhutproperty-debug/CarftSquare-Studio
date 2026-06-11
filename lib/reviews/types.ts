export type ReviewStatus = 'pending' | 'approved' | 'rejected';

export interface CustomerReview {
  id: string;
  customerName: string;
  projectType: string;
  rating: number;
  reviewText: string;
  images: string[];
  area: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
}
