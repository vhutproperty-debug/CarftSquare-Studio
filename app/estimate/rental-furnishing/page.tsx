import EstimateChat from '@/components/estimate/EstimateChat';
import EstimateLayout from '@/components/estimate/EstimateLayout';

export default function RentalFurnishingEstimatePage() {
  return (
    <EstimateLayout
      title="Rental Furnishing Estimate"
      subtitle="Dedicated AI consultant for investor-ready rental furnishing — independent pricing from interior quotations."
    >
      <EstimateChat
        moduleId="rental-furnishing"
        landingPage="/estimate/rental-furnishing"
        leadSource="ai-estimate-rental"
        campaignName="rental-furnishing"
      />
    </EstimateLayout>
  );
}
