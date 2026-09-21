/**
 * Where the shop is, off the shop.
 *
 * One place rather than inline in the footer: these are the same URLs an
 * Organization JSON-LD's `sameAs` wants, and the same ones a contact page
 * would list — and a profile that gets renamed should be corrected once, not
 * hunted for.
 *
 * Order is the order they are shown in.
 */
export const SOCIAL_LINKS = [
  { key: "instagram", url: "https://www.instagram.com/silomis.co/" },
  { key: "facebook", url: "https://www.facebook.com/people/Silomis/61594110065357/" },
  { key: "tiktok", url: "https://www.tiktok.com/@silomis.com" },
] as const;

export type SocialKey = (typeof SOCIAL_LINKS)[number]["key"];

/** The URL for one network, by key. */
export const SOCIAL_URL: Record<SocialKey, string> = Object.fromEntries(
  SOCIAL_LINKS.map((s) => [s.key, s.url]),
) as Record<SocialKey, string>;
