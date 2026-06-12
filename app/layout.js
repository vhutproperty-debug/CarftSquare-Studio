import Script from 'next/script';
import DesignerCallbackRoot from '@/components/DesignerCallbackRoot';
import RateUsRoot from '@/components/RateUsRoot';
import MetaPixelRoot from '@/components/MetaPixelRoot';
import { META_PIXEL_ID } from '@/lib/meta-pixel-id';
import { getRootMetadata } from '@/lib/seo/metadata';
import './globals.css';

export const metadata = getRootMetadata();

const RootLayout = ({ children }) => {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  const isProduction = process.env.NODE_ENV === 'production';
  const metaPixelId = isProduction
    ? (process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || META_PIXEL_ID)
    : null;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <link rel="icon" type="image/png" href="/branding/craftsquare-studio-logo.png" />
        <link rel="apple-touch-icon" href="/branding/craftsquare-studio-logo.png" />
      </head>
      <body>
        {children}
        <DesignerCallbackRoot />
        <RateUsRoot />
        <MetaPixelRoot />
        {metaPixelId && (
          <>
            {/* Meta Pixel Code — Events Manager base snippet */}
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
              `}
            </Script>
            <noscript>
              <img
                height="1"
                width="1"
                style={{ display: 'none' }}
                src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
            {/* End Meta Pixel Code */}
          </>
        )}
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
