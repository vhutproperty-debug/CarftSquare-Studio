import OpsShell from '@/components/ops/OpsShell';
import ImportWorkspace from '@/components/ops/contacts/ImportWorkspace';

export const dynamic = 'force-dynamic';

export default function OpsContactImportPage() {
  return (
    <OpsShell
      title="Import contacts"
      subtitle="Super admins can map a CSV or spreadsheet, review phone duplicates, and undo the batch."
      pipelineStage="supply"
    >
      <ImportWorkspace />
    </OpsShell>
  );
}
