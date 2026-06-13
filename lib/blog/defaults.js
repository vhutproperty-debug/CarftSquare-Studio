import { BRAND, absoluteLogoUrl } from '@/lib/brand';
import { absoluteUrl } from '@/lib/site';

const AUTHOR = { name: BRAND.name, role: 'Design Team' };

export const DEFAULT_BLOG_POSTS = [
  {
    id: 'modular-kitchen-trends-mumbai-2025',
    slug: 'modular-kitchen-trends-mumbai-2025',
    title: 'Modular Kitchen Trends in Mumbai for 2025',
    excerpt: 'Discover the latest modular kitchen layouts, finishes and storage ideas shaping Mumbai homes this year.',
    category: 'Modular Kitchen',
    featuredImage: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    author: AUTHOR,
    publishedAt: '2025-11-15T10:00:00.000Z',
    status: 'published',
    tags: ['Modular Kitchen', 'Mumbai', 'Trends'],
    content: `
      <p>Mumbai apartments demand kitchens that balance compact footprints with premium finishes. In 2025, homeowners are prioritising <strong>handleless shutters</strong>, quartz countertops and integrated appliances that keep work zones clutter-free.</p>
      <h2>Layout choices that work in Mumbai</h2>
      <p>L-shaped and parallel kitchens remain the most practical for 2BHK and 3BHK homes. Adding a breakfast counter turns a cooking zone into a social hub without expanding the footprint.</p>
      <h2>Materials worth investing in</h2>
      <ul>
        <li>Boiling-water taps and built-in hobs for a seamless look</li>
        <li>Soft-close drawers with internal organisers</li>
        <li>Anti-fingerprint laminates for high-traffic zones</li>
      </ul>
      <p>At ${BRAND.name}, every modular kitchen is designed site-first, then manufactured to millimetre accuracy for faster installation.</p>
    `.trim(),
    seo: {
      metaTitle: `Modular Kitchen Trends Mumbai 2025 | ${BRAND.name}`,
      metaDescription: 'Latest modular kitchen trends, layouts and finishes for Mumbai apartments in 2025.',
      keywords: ['Modular Kitchen Mumbai', 'Kitchen Design Trends', BRAND.name],
      ogImage: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
      canonicalUrl: absoluteUrl('/blog/modular-kitchen-trends-mumbai-2025'),
    },
  },
  {
    id: 'rental-interior-roi-mumbai',
    slug: 'rental-interior-roi-mumbai',
    title: 'How Rental Interiors Improve ROI for Mumbai Investors',
    excerpt: 'Furnished rental setups can reduce vacancy periods and command higher rents — here is how to plan smartly.',
    category: 'Rental Interiors',
    featuredImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    author: AUTHOR,
    publishedAt: '2025-10-28T10:00:00.000Z',
    status: 'published',
    tags: ['Rental Interiors', 'Investment', 'Mumbai'],
    content: `
      <p>Investor-owned apartments in Mumbai compete on move-in readiness. A well-furnished rental interior can shorten listing time and justify a premium monthly rent.</p>
      <h2>Focus on tenant-ready essentials</h2>
      <p>Bedrooms with storage, a functional kitchenette, durable flooring and quality lighting deliver the highest perceived value per rupee spent.</p>
      <h2>Package tiers that scale</h2>
      <p>Essential, premium and luxury furnishing tiers let investors match spend to target tenant profiles — from young professionals to corporate leases.</p>
      <p>${BRAND.name} offers end-to-end rental furnishing with installation timelines aligned to possession handovers.</p>
    `.trim(),
    seo: {
      metaTitle: `Rental Interior ROI Mumbai | ${BRAND.name}`,
      metaDescription: 'How rental interior furnishing improves rental yield and reduces vacancy for Mumbai property investors.',
      keywords: ['Rental Interiors Mumbai', 'Furnished Apartment Mumbai', BRAND.name],
      ogImage: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
      canonicalUrl: absoluteUrl('/blog/rental-interior-roi-mumbai'),
    },
  },
  {
    id: 'small-space-interior-design-tips',
    slug: 'small-space-interior-design-tips',
    title: '7 Interior Design Tips for Compact Mumbai Homes',
    excerpt: 'Make small apartments feel larger with zoning, multi-functional furniture and smart lighting strategies.',
    category: 'Interior Design',
    featuredImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    author: AUTHOR,
    publishedAt: '2025-10-10T10:00:00.000Z',
    status: 'published',
    tags: ['Interior Design', 'Small Spaces', 'Mumbai'],
    content: `
      <p>Compact Mumbai homes reward thoughtful planning. The right interior choices create breathing room without structural changes.</p>
      <h2>Design moves that add perceived space</h2>
      <ol>
        <li>Use a consistent light palette on walls and ceilings</li>
        <li>Choose legged furniture to expose floor area</li>
        <li>Install layered lighting instead of a single ceiling source</li>
        <li>Build wardrobes to full ceiling height</li>
        <li>Define zones with rugs rather than walls</li>
        <li>Opt for sliding or pocket doors where possible</li>
        <li>Keep circulation paths at least 90 cm clear</li>
      </ol>
      <p>Our design team at ${BRAND.name} maps every square foot before specifying furniture or finishes.</p>
    `.trim(),
    seo: {
      metaTitle: `Small Space Interior Design Tips Mumbai | ${BRAND.name}`,
      metaDescription: 'Practical interior design tips to maximise space in compact Mumbai apartments.',
      keywords: ['Small Space Interior Design', 'Interior Design Mumbai', BRAND.name],
      ogImage: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
      canonicalUrl: absoluteUrl('/blog/small-space-interior-design-tips'),
    },
  },
  {
    id: 'wardrobe-planning-guide',
    slug: 'wardrobe-planning-guide',
    title: 'The Complete Wardrobe Planning Guide for Indian Homes',
    excerpt: 'Internal layouts, shutter finishes and accessory planning for wardrobes that stay organised for years.',
    category: 'Wardrobes',
    featuredImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
    author: AUTHOR,
    publishedAt: '2025-09-22T10:00:00.000Z',
    status: 'published',
    tags: ['Wardrobes', 'Storage', 'Planning'],
    content: `
      <p>A wardrobe should be planned around how you dress, not just how it looks from the outside. Start with a lifestyle audit before choosing internals.</p>
      <h2>Internals that matter</h2>
      <p>Long-hang sections, trouser pull-outs, jewellery trays and shoe racks should be allocated based on actual wardrobe habits.</p>
      <h2>Finishes for durability</h2>
      <p>High-gloss shutters make a statement; textured laminates hide daily fingerprints. Both work when hinges and channels are premium-grade.</p>
      <p>Book a free consultation with ${BRAND.name} to get a measured wardrobe proposal for your home.</p>
    `.trim(),
    seo: {
      metaTitle: `Wardrobe Planning Guide | ${BRAND.name} Mumbai`,
      metaDescription: 'Complete guide to planning modular wardrobes — layouts, finishes and accessories for Indian homes.',
      keywords: ['Wardrobe Design Mumbai', 'Modular Wardrobe', BRAND.name],
      ogImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200',
      canonicalUrl: absoluteUrl('/blog/wardrobe-planning-guide'),
    },
  },
];

export const DEFAULT_BLOG_SEO = {
  metaTitle: `Interior Design Blog | ${BRAND.name} Mumbai`,
  metaDescription: 'Expert interior design insights, modular kitchen tips, rental furnishing guides and Mumbai home inspiration from CraftSquare Studio.',
  keywords: ['Interior Design Blog Mumbai', 'Home Decor Tips', 'Modular Kitchen Ideas', BRAND.name],
  ogImage: absoluteLogoUrl,
  canonicalUrl: absoluteUrl('/blog'),
};
