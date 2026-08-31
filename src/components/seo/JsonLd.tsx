/**
 * Structured data, rendered into the server HTML.
 *
 * Deliberately a plain <script> and not next/script: that component injects
 * after hydration, so the JSON-LD is absent from the document a crawler
 * actually fetches — which is the only copy most of them read. This is the
 * shape Next's own docs recommend for JSON-LD.
 *
 * `<` is escaped because a `</script>` sequence inside the payload — from a
 * product description or an FAQ answer — would otherwise close the tag early
 * and spill the rest of the JSON into the page as markup.
 */
export default function JsonLd({ id, data }: { id: string; data: unknown }) {
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
