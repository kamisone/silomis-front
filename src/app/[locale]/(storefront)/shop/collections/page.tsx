import { permanentRedirect } from "next/navigation";

/** See [slug]/page.tsx — the collections index moved to /collections. */
export default async function LegacyCollectionsIndexRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/collections`);
}
