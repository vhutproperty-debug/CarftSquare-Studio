import { BRAND } from '@/lib/brand';
import { cn } from '@/lib/utils';

const VARIANTS = {
  nav: 'h-11 w-auto max-w-[140px] rounded-lg object-contain sm:h-12 sm:max-w-[160px]',
  footer: 'h-14 w-auto max-w-[180px] rounded-lg object-contain',
  compact: 'h-10 w-auto max-w-[120px] rounded-lg object-contain',
};

export default function BrandLogo({ variant = 'nav', className, ...props }) {
  return (
    <img
      src={BRAND.logoUrl}
      alt={BRAND.name}
      className={cn(VARIANTS[variant] || VARIANTS.nav, className)}
      {...props}
    />
  );
}
