import Script from 'next/script';
import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import './globals.css';

export const metadata = {
  title: 'CraftSquare Studio | Premium Interior Design & Solutions Mumbai',
  description: 'Transform your space with expert interior design, modular kitchens, wardrobes, rental interiors and turnkey execution in Mumbai. Book free consultation today.',
  keywords: [
    'Interior Design Mumbai',
    'Modular Kitchen Mumbai',
    'Wardrobe Design Mumbai',
    'Rental Interiors Mumbai',
    'Turnkey Interiors Mumbai',
    'Commercial Interiors Mumbai',
    'Home Renovation Mumbai',
    'Interior Designer Mumbai',
    'Residential Interiors Mumbai',
    'Space Planning Mumbai',
    'Interior Styling Mumbai',
    'Modular Wardrobes Mumbai',
  ],
  openGraph: {
    title: 'CraftSquare Studio | Premium Interior Design & Solutions Mumbai',
    description: 'Design-to-execution interior solutions — modular kitchens, wardrobes, rental interiors and complete home transformations in Mumbai.',
    type: 'website',
    images: [{ url: absoluteLogoUrl, alt: BRAND.name }],
  },
  icons: {
    icon: BRAND.logoUrl,
    apple: BRAND.logoUrl,
  },
};

const RootLayout = ({ children }) => {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
        {gaId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = window.gtag || gtag;
                gtag('js', new Date());
                gtag('config', '${gaId}', {
                  page_path: window.location.pathname,
                  send_page_view: true
                });
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
};

export default RootLayout;
