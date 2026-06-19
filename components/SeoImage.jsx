import Image from 'next/image';

function isOptimizableSrc(src = '') {
  return Boolean(src) && (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://'));
}

/** Avoid next/image crashes when featuredImage is a page URL or non-image link. */
function isLikelyImageSrc(src = '') {
  if (!src || src.startsWith('/')) return true;
  try {
    const { pathname } = new URL(src);
    return /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(pathname);
  } catch {
    return false;
  }
}

export default function SeoImage({
  src,
  alt = '',
  className = '',
  priority = false,
  width,
  height,
  fill = false,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
}) {
  if (!isOptimizableSrc(src)) return null;

  if (!isLikelyImageSrc(src)) {
    if (fill) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt || ''}
          className={className}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          style={{ objectFit: 'cover', width: '100%', height: '100%' }}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || ''}
        className={className}
        width={width || 1200}
        height={height || 800}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    );
  }

  const shared = {
    src,
    alt: alt || '',
    className,
    priority,
  };

  if (fill) {
    return (
      <Image
        {...shared}
        alt={alt || ''}
        fill
        sizes={sizes}
        loading={priority ? 'eager' : 'lazy'}
      />
    );
  }

  return (
    <Image
      {...shared}
      alt={alt || ''}
      width={width || 1200}
      height={height || 800}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
    />
  );
}
