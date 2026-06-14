function looksLikeHtml(content = '') {
  return /<\/?[a-z][\s\S]*>/i.test(content);
}

function textToHtml(content = '') {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${block.replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function optimizeContentImages(html = '') {
  return html.replace(/<img\b([^>]*?)>/gi, (match, attrs) => {
    if (/loading\s*=/i.test(attrs)) return match;
    return `<img loading="lazy" decoding="async"${attrs}>`;
  });
}

export default function BlogRichContent({ content = '', contentFormat = 'html' }) {
  const rawHtml = contentFormat === 'text' || !looksLikeHtml(content)
    ? textToHtml(content)
    : content;
  const html = optimizeContentImages(rawHtml);

  return (
    <div
      className="blog-rich-content max-w-none text-base leading-8 text-slate-700 [&_a]:font-semibold [&_a]:text-orange-600 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-orange-200 [&_blockquote]:pl-4 [&_blockquote]:italic [&_h2]:mb-4 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-black [&_h2]:text-slate-950 [&_h3]:mb-3 [&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-black [&_h3]:text-slate-950 [&_img]:h-auto [&_img]:max-w-full [&_li]:mb-2 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_strong]:font-bold [&_strong]:text-slate-950 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
