import { Facebook, Instagram, Twitter } from 'lucide-react';
import { SOCIAL_LINK_ITEMS } from '@/lib/social';

const ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  twitter: Twitter,
};

export default function SocialLinks({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-label="Social media links">
      {SOCIAL_LINK_ITEMS.map((item) => {
        if (!item.href) return null;
        const Icon = ICONS[item.id];
        return (
          <a
            key={item.id}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Follow CraftSquare Studio on ${item.label}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-orange-600 sm:h-10 sm:w-10"
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}
