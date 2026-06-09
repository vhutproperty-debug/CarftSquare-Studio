import EstimateChat from '@/components/estimate/EstimateChat';
import EstimateLayout from '@/components/estimate/EstimateLayout';

export default function WardrobeEstimatePage() {
  return (
    <EstimateLayout title="Wardrobe Estimate" subtitle="AI-assisted custom wardrobe planning with instant preliminary estimate.">
      <EstimateChat moduleId="wardrobe" landingPage="/estimate/wardrobe" leadSource="ai-estimate-wardrobe" />
    </EstimateLayout>
  );
}
