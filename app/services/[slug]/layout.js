import { buildServiceMetadata } from '@/lib/seo/metadata';
import { buildServiceJsonLd } from '@/lib/seo/jsonld';
import { serviceBreadcrumb } from '@/lib/seo/breadcrumbs';
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
      title: { absolute: 'Service Not Found' },
      robots: { index: false, follow: false },
    };
  }

  return buildServiceMetadata(service, slug);
}

export default async function ServiceLayout({ children, params }) {
  const service = await loadServiceBySlug(params.slug);
  const serviceSchema = buildServiceJsonLd(service, params.slug);
  const breadcrumbSchema = serviceBreadcrumb(service?.name || 'Service', params.slug);

  return (
    <>
      {serviceSchema ? <JsonLd data={serviceSchema} /> : null}
      <JsonLd data={breadcrumbSchema} />
      {children}
    </>
  );
}
