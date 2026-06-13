import Image from 'next/image';

function isOptimizableSrc(src = '') {
  return Boolean(src) && (src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://'));
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
