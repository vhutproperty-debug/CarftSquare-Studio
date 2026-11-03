import FinanceDesk from '@/components/ops/finance/FinanceDesk';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function FinancePage() {
  return (
    <OpsShell title="Finance" subtitle="Expenses, the payments ledger, and profit from verified collections only." pipelineStage="revenue" dense>
      <FinanceDesk />
    </OpsShell>
  );
}
