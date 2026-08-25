import type { Metadata } from "next";
import ContentEditor from "@/components/admin/content/ContentEditorClient";
import ui from "@/components/admin/ui/admin-ui.module.css";

export const metadata: Metadata = { title: "Content — Admin" };

export default function ContentPage() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Policies</h1>
      </div>
      <ContentEditor />
    </div>
  );
}
