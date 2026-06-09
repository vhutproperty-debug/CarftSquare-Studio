import EstimateChat from '@/components/estimate/EstimateChat';
import EstimateLayout from '@/components/estimate/EstimateLayout';

export default function OfficeEstimatePage() {
  return (
    <EstimateLayout title="Office Interior Estimate" subtitle="AI-assisted office interior consultation with instant preliminary estimate.">
      <EstimateChat moduleId="office-interior" landingPage="/estimate/office" leadSource="ai-estimate-office" />
    </EstimateLayout>
  );
}
