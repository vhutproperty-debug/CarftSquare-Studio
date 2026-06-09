import EstimateChat from '@/components/estimate/EstimateChat';
import EstimateLayout from '@/components/estimate/EstimateLayout';

export default function KitchenEstimatePage() {
  return (
    <EstimateLayout title="Modular Kitchen Estimate" subtitle="AI-assisted modular kitchen planning with instant preliminary estimate.">
      <EstimateChat moduleId="modular-kitchen" landingPage="/estimate/kitchen" leadSource="ai-estimate-kitchen" />
    </EstimateLayout>
  );
}
