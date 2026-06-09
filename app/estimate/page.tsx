import EstimateChat from '@/components/estimate/EstimateChat';
import EstimateLayout from '@/components/estimate/EstimateLayout';

export default function EstimatePage() {
  return (
    <EstimateLayout
      premium
      stepLabel="Step 1 of 8 • Approx. 2 Minutes"
      title="Meet Your AI Interior Consultant"
      subtitle="Answer a few intelligent questions and receive a personalised interior estimate, design direction and furnishing recommendation."
    >
      <EstimateChat moduleId="home-interior" landingPage="/estimate" leadSource="ai-estimate-interior" />
    </EstimateLayout>
  );
}
