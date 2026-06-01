import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import { absoluteUrl } from '@/lib/site';
import { buildMetadata } from '@/lib/seo/metadata';
import { buildBreadcrumbJsonLd, buildServiceJsonLd } from '@/lib/seo/jsonld';
import { loadServiceBySlug } from '@/lib/seo/load';
import { DEFAULT_SERVICES } from '@/lib/cms/defaults';
import JsonLd from '@/components/JsonLd';

export async function generateStaticParams() {
  return DEFAULT_SERVICES.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }) {
  const slug = params.slug;
  const service = await loadServiceBySlug(slug);

  if (!service) {
    return {
      title: 'Service Not Found',
      robots: { index: false, follow: false },
    };
  }

  const seo = service.seo?.metaTitle
    ? service.seo
    : {
      metaTitle: `${service.name} | ${BRAND.name} Mumbai`,
      metaDescription: service.shortDescription || service.description,
      keywords: [`${service.name} Mumbai`, 'Interior Design Mumbai', BRAND.name],
      ogImage: service.heroImage || absoluteLogoUrl,
      canonicalUrl: absoluteUrl(`/services/${slug}`),
    };

  return buildMetadata({
    seo,
    path: `/services/${slug}`,
    ogType: 'website',
  });
}

export default async function ServiceLayout({ children, params }) {
  const service = await loadServiceBySlug(params.slug);
  const serviceSchema = buildServiceJsonLd(service, params.slug);
  const breadcrumbSchema = buildBreadcrumbJsonLd([
    { name: 'Home', url: absoluteUrl('/') },
    { name: 'Services', url: absoluteUrl('/#services') },
    { name: service?.name || 'Service', url: absoluteUrl(`/services/${params.slug}`) },
  ]);

  return (
    <>
      {serviceSchema ? <JsonLd data={serviceSchema} /> : null}
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
