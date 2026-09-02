import type { Metadata } from "next";
import ContentEditorClient from "@/components/admin/content/ContentEditorClient";
import type { ContentPage } from "@/components/admin/content/ContentEditor";
import ui from "@/components/admin/ui/admin-ui.module.css";

export const metadata: Metadata = { title: "New Arrivals Page — Admin" };

/** One page, so the editor renders without its tab row. */
const PAGES: ContentPage[] = [{ slug: "new", label: "New arrivals page" }];

export default function NewArrivalsPageContent() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>New Arrivals Page</h1>
      </div>
      <p className={ui.pageHint}>
        Copy for the storefront <code>/new</code> listing, per language. Nothing here is filled in for you: a field left blank is simply
        not rendered — no title, no intro. Which products the page lists is not set here; a product appears while its <strong>New</strong>{" "}
        switch is on, under Status &amp; Visibility on the product itself.
      </p>
      <ContentEditorClient
        pages={PAGES}
        translate
        note="Blank fields render nothing on the storefront — there is no built-in fallback copy"
      />
    </div>
  );
}
