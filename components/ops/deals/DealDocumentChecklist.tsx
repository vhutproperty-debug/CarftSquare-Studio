'use client';

import type { DealDocumentsChecklist } from '@/lib/ops/deals/types';

const DOC_ITEMS: Array<{ key: keyof DealDocumentsChecklist; label: string }> = [
  { key: 'clientKyc', label: 'Client KYC' },
  { key: 'ownerKyc', label: 'Owner KYC' },
  { key: 'draftAgreement', label: 'Draft agreement' },
  { key: 'signedAgreement', label: 'Signed agreement' },
  { key: 'tokenReceipt', label: 'Token receipt' },
  { key: 'commissionInvoice', label: 'Commission invoice' },
  { key: 'noc', label: 'NOC' },
  { key: 'societyNoc', label: 'Society NOC' },
];

type DealDocumentChecklistProps = {
  checklist: DealDocumentsChecklist;
  onChange: (checklist: DealDocumentsChecklist) => void;
  disabled?: boolean;
};

export default function DealDocumentChecklist({ checklist, onChange, disabled }: DealDocumentChecklistProps) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {DOC_ITEMS.map(({ key, label }) => (
        <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={!!checklist[key]}
            disabled={disabled}
            onChange={(e) => onChange({ ...checklist, [key]: e.target.checked })}
          />
          <span className={checklist[key] ? 'font-semibold text-emerald-800' : 'text-slate-700'}>{label}</span>
        </label>
      ))}
    </div>
  );
}
