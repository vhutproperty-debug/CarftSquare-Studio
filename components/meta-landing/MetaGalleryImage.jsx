import Image from 'next/image';

function isLocalSrc(src = '') {
  return src.startsWith('/');
}

function isRemoteOptimizable(src = '') {
  if (!src.startsWith('http')) return false;
  try {
    const { hostname } = new URL(src);
    const allowed = [
      'images.unsplash.com',
      'craftsquare.studio',
      'www.craftsquare.studio',
      'craftsquare.co.in',
      'www.craftsquare.co.in',
    ];
    return allowed.some((host) => hostname === host || hostname.endsWith('.craftsquare.studio'));
  } catch {
    return false;
  }
}

export default function MetaGalleryImage({
  src,
  alt = '',
  fill = false,
  priority = false,
  className = '',
  sizes = '(max-width: 768px) 85vw, (max-width: 1200px) 45vw, 33vw',
}) {
  if (!src) return null;

  if (isLocalSrc(src) || isRemoteOptimizable(src)) {
    if (fill) {
      return (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
          className={className}
        />
      );
    }
    return (
      <Image
        src={src}
        alt={alt}
        width={800}
        height={600}
        sizes={sizes}
        priority={priority}
        loading={priority ? 'eager' : 'lazy'}
        className={className}
      />
    );
  }

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className={className}
        style={{ objectFit: 'cover', width: '100%', height: '100%' }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />
  );
}
