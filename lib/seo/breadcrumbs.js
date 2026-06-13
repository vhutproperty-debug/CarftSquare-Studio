import { absoluteUrl } from '@/lib/site';
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';

export function breadcrumbTrail(items) {
  return buildBreadcrumbJsonLd(items);
}

export function homeBreadcrumb() {
  return breadcrumbTrail([{ name: 'Home', url: absoluteUrl('/') }]);
}

export function pageBreadcrumb(name, path) {
  return breadcrumbTrail([
    { name: 'Home', url: absoluteUrl('/') },
    { name, url: absoluteUrl(path) },
  ]);
}

export function blogPostBreadcrumb(title, slug) {
  return breadcrumbTrail([
    { name: 'Home', url: absoluteUrl('/') },
    { name: 'Blog', url: absoluteUrl('/blog') },
    { name: title, url: absoluteUrl(`/blog/${slug}`) },
  ]);
}

export function serviceBreadcrumb(name, slug) {
  return breadcrumbTrail([
    { name: 'Home', url: absoluteUrl('/') },
    { name: 'Services', url: absoluteUrl('/#services') },
    { name, url: absoluteUrl(`/services/${slug}`) },
  ]);
}
