'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Building2 } from 'lucide-react';
import { AURIS_TOWER_IMAGE } from '@/lib/auris-serenity/constants';

type AurisHeroImageProps = {
  hasTowerImage: boolean;
};

export default function AurisHeroImage({ hasTowerImage }: AurisHeroImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = hasTowerImage && !imageFailed;

  if (showImage) {
    return (
      <Image
        src={AURIS_TOWER_IMAGE}
        alt="Auris Serenity residential towers, Mumbai"
        fill
        priority
        sizes="100vw"
        className="object-cover object-[50%_42%] md:object-[50%_48%] lg:object-[center_52%]"
        onError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950"
      aria-hidden="true"
    >
      <div className="absolute inset-0 opacity-30">
        <div className="absolute bottom-0 left-1/2 h-[70%] w-[45%] -translate-x-1/2 rounded-t-[2rem] bg-gradient-to-t from-slate-600/40 to-slate-400/10" />
        <div className="absolute bottom-0 left-[18%] h-[45%] w-[22%] rounded-t-xl bg-slate-700/20" />
        <div className="absolute bottom-0 right-[18%] h-[55%] w-[24%] rounded-t-xl bg-slate-700/20" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-500/80">
          <Building2 className="h-16 w-16 md:h-20 md:w-20" strokeWidth={1} />
          <p className="text-xs font-medium uppercase tracking-[0.2em]">Auris Serenity</p>
        </div>
      </div>
    </div>
  );
}
