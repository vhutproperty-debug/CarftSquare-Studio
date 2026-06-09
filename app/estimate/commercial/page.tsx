import EstimateChat from '@/components/estimate/EstimateChat';
import EstimateLayout from '@/components/estimate/EstimateLayout';

export default function CommercialEstimatePage() {
  return (
    <EstimateLayout title="Commercial Interior Estimate" subtitle="AI-assisted commercial interior consultation with instant preliminary estimate.">
      <EstimateChat moduleId="commercial-interior" landingPage="/estimate/commercial" leadSource="ai-estimate-commercial" />
    </EstimateLayout>
  );
}
