import type { Metadata } from "next";
import ContentEditorClient from "@/components/admin/content/ContentEditorClient";
import type { ContentPage } from "@/components/admin/content/ContentEditor";
import ui from "@/components/admin/ui/admin-ui.module.css";

export const metadata: Metadata = { title: "Sale Page — Admin" };

/** One page, so the editor renders without its tab row. */
const PAGES: ContentPage[] = [{ slug: "sale", label: "Sale page" }];

export default function SalePageContent() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Sale Page</h1>
      </div>
      <p className={ui.pageHint}>
        Copy for the storefront <code>/sale</code> listing, per language. Nothing here is filled in for you: a field left blank is simply
        not rendered — no title, no intro. Which products the page lists is not set here; a product appears when its card would show a
        discount, either because its default variant has a compare-at price above its selling price, or because an active automatic
        promotion is scoped to it or one of its categories.
      </p>
      <ContentEditorClient
        pages={PAGES}
        translate
        note="Blank fields render nothing on the storefront — there is no built-in fallback copy"
      />
    </div>
  );
}
