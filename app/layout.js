import Script from 'next/script';
import './globals.css';

export const metadata = {
  title: 'Brush & Bloom | Premium Painting & Interior Solutions Mumbai',
  description: 'Transform your home with expert painting, modular kitchens, wardrobes, and complete interior consultation in Mumbai. Book free site visit today.',
  keywords: [
    'Painting Services Mumbai',
    'Modular Kitchen Mumbai',
    'Wardrobe Contractors Mumbai',
    'Interior Designer Mumbai',
    'Home Renovation Mumbai',
    'Luxury Painting Mumbai',
    'Premium Interiors Mumbai',
    'House Painting Mumbai',
    'Waterproofing Services Mumbai',
    'Interior Painting Mumbai',
    '2BHK Painting Cost Mumbai',
    'Painter Near Me',
    'Complete Home Transformation Mumbai',
  ],
  openGraph: {
    title: 'Brush & Bloom | Premium Painting & Complete Interior Solutions Mumbai',
    description: 'From premium painting to complete interior solutions. Modular kitchens, wardrobes, and interior consultation under one trusted brand in Mumbai.',
    type: 'website',
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
