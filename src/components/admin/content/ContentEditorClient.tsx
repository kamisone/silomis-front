"use client";

import dynamic from "next/dynamic";

// TipTap/ProseMirror needs browser globals — load client-side only. `dynamic(..., { ssr: false })`
// is only allowed inside a Client Component, so this wrapper exists purely to host that call for
// the (server) page.tsx that renders it.
const ContentEditor = dynamic(() => import("./ContentEditor"), { ssr: false });

export default function ContentEditorClient() {
  return <ContentEditor />;
}
