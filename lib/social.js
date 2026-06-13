/** Public social profile URLs — override via NEXT_PUBLIC_SOCIAL_* env vars */
export const SOCIAL_LINKS = {
  instagram:
    process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM?.trim() || 'https://www.instagram.com/craftsquare_studio/',
  facebook:
    process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK?.trim() || 'https://www.facebook.com/profile.php?id=61590510189953',
  twitter:
    process.env.NEXT_PUBLIC_SOCIAL_TWITTER?.trim() || 'https://x.com/CraftSquare_St',
};

export const SOCIAL_LINK_ITEMS = [
  { id: 'instagram', label: 'Instagram', href: SOCIAL_LINKS.instagram },
  { id: 'facebook', label: 'Facebook', href: SOCIAL_LINKS.facebook },
  { id: 'twitter', label: 'X (Twitter)', href: SOCIAL_LINKS.twitter },
];
