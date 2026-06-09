export const BRAND = {
  name: 'CraftSquare Studio',
  tagline: 'Designing Spaces, Creating Experiences',
  city: 'Mumbai',
  phone: '+91 73042 42604',
  whatsappNumber: '917304242604',
  logoUrl: '/branding/craftsquare-studio-logo.png',
  emailFrom: 'CraftSquare Studio <notifications@craftsquare.studio>',
  emailTo: 'arunpandey@craftsquare.studio',
  domain: 'craftsquare.studio',
  sessionSuffix: 'craftsquare-admin-session',
  appId: 'craftsquarestudio',
};

export const absoluteLogoUrl = `https://${BRAND.domain}${BRAND.logoUrl}`;

export const whatsappText = encodeURIComponent(
  'Hi CraftSquare Studio, I would like a free design consultation for my interior project in Mumbai.',
);

export const whatsappUrl = `https://wa.me/${BRAND.whatsappNumber}?text=${whatsappText}`;
