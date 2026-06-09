'use client';

import { Button } from '@/components/ui/button';
import type { QuickAdjustmentAction } from '@/lib/estimate/types';

const ACTIONS: Array<{ id: QuickAdjustmentAction; label: string }> = [
  { id: 'reduce_10', label: 'Reduce Budget 10%' },
  { id: 'reduce_20', label: 'Reduce Budget 20%' },
  { id: 'upgrade_premium', label: 'Upgrade to Premium' },
  { id: 'upgrade_luxury', label: 'Upgrade to Luxury' },
  { id: 'maximize_storage', label: 'Maximize Storage' },
  { id: 'luxury_aesthetics', label: 'Luxury Aesthetics' },
  { id: 'rental_friendly', label: 'Rental Friendly' },
  { id: 'airbnb_ready', label: 'Airbnb Ready' },
];

export default function EstimateQuickActions({
  onAdjust,
  loading,
}: {
  onAdjust: (action: QuickAdjustmentAction) => void;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map((action) => (
        <Button
          key={action.id}
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => onAdjust(action.id)}
          className="rounded-full border-orange-200 text-xs font-bold hover:bg-orange-50"
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
