/**
 * Visible text of an admin-authored inline HTML fragment.
 *
 * For the places that need a string rather than markup — a card header, a
 * confirm dialog, a `<title>`, an aria-label. Deliberately not a sanitiser:
 * it strips every tag rather than filtering some, so it is only ever safe as
 * *plain text*, never as something rendered back as HTML.
 */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
