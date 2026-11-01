import OpsShell from '@/components/ops/OpsShell';
import MarketWorkspace from '@/components/ops/market/MarketWorkspace';

export default function OpsMarketPage() {
  return (
    <OpsShell
      title="Market"
      subtitle="Match available flats with active requirements, see where supply and demand diverge, and share a card that leaves price for the call."
      pipelineStage="matching"
    >
      <MarketWorkspace />
    </OpsShell>
  );
}
