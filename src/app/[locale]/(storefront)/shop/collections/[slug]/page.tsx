import { permanentRedirect } from "next/navigation";

/** Collections moved from /shop/collections/[slug] to the shorter, SEO-friendlier
 * /collections/[slug]. Kept as a 308 so old links, bookmarks and any already-indexed
 * URLs land on the new page and pass their ranking on instead of 404ing. */
export default async function LegacyCollectionRedirect({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  permanentRedirect(`/${locale}/collections/${slug}`);
}
