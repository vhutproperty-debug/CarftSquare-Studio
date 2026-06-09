import type {
  ButtonHTMLAttributes,
  ForwardRefExoticComponent,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  RefAttributes,
} from 'react';

type DivProps = HTMLAttributes<HTMLDivElement> & { children?: ReactNode };
type DivRef = ForwardRefExoticComponent<DivProps & RefAttributes<HTMLDivElement>>;

declare module '@/components/ui/button' {
  export const Button: ForwardRefExoticComponent<
    ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string } & RefAttributes<HTMLButtonElement>
  >;
}

declare module '@/components/ui/input' {
  export const Input: ForwardRefExoticComponent<InputHTMLAttributes<HTMLInputElement> & RefAttributes<HTMLInputElement>>;
}

declare module '@/components/ui/card' {
  export const Card: DivRef;
  export const CardHeader: DivRef;
  export const CardTitle: DivRef;
  export const CardContent: DivRef;
}

declare module '@/components/ui/badge' {
  export const Badge: React.FC<{ className?: string; variant?: string; children?: ReactNode }>;
}

declare module '@/components/ui/skeleton' {
  export const Skeleton: React.FC<{ className?: string }>;
}

declare module '@/components/BrandLogo' {
  const BrandLogo: React.FC<{ variant?: string; className?: string }>;
  export default BrandLogo;
}

declare module '@/lib/brand' {
  export const BRAND: {
    name: string;
    domain: string;
    logoUrl: string;
    [key: string]: string;
  };
}
