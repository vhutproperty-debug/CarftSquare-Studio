import DuplicateReviewQueue from '@/components/ops/workspace/DuplicateReviewQueue';
import OpsShell from '@/components/ops/OpsShell';

export const dynamic = 'force-dynamic';

export default function DuplicateReviewsPage() {
  return (
    <OpsShell title="Duplicate reviews" subtitle="Same phone, two contacts. Review them without merging." dense>
      <DuplicateReviewQueue />
    </OpsShell>
  );
}
