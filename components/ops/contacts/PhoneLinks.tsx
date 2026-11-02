'use client';

import { formatPhoneDisplay } from '@/lib/ops/phone';

export default function PhoneLinks({ contactId, phones }: { contactId: string; phones: string[] }) {
  if (!phones.length) return <span className="text-slate-400">No phone</span>;
  return (
    <span className="inline-flex flex-wrap gap-2">
      {phones.map((phone) => (
        <a
          key={phone}
          href={`tel:${phone}`}
          className="font-semibold text-orange-700 underline-offset-2 hover:underline"
          onClick={() => {
            void fetch(`/api/ops/contacts/${contactId}/call-tap`, {
              method: 'POST',
              credentials: 'include',
              keepalive: true,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ phone }),
            });
          }}
        >
          {formatPhoneDisplay(phone)}
        </a>
      ))}
    </span>
  );
}
