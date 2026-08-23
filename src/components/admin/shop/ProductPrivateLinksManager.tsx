"use client";

import { useState, type CSSProperties } from "react";
import { Lock, Trash2, Plus, ExternalLink } from "lucide-react";
import type { ProductPrivateLink } from "@/lib/shop/productContent.types";
import peStyles from "@/app/admin/shop/products/ProductEdit.module.css";

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Props {
  initialLinks: ProductPrivateLink[];
  onChange: (links: ProductPrivateLink[]) => void;
}

const cardStyle: CSSProperties = {
  border: "1.5px solid var(--color-surface)",
  borderRadius: 12,
  background: "var(--background)",
  marginBottom: 10,
};
const cardHeadStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "10px 12px",
  borderBottom: "1px solid var(--color-surface)",
};
const cardBodyStyle: CSSProperties = {
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const removeBtnStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "#ef4444",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0,
  marginLeft: "auto",
};
const labelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "color-mix(in srgb, var(--foreground) 70%, transparent)",
  textTransform: "uppercase",
  letterSpacing: ".04em",
};
const inputStyle: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1.5px solid var(--color-surface)",
  fontSize: 13,
  background: "var(--background)",
  color: "var(--foreground)",
};
const addBtnStyle: CSSProperties = {
  width: "100%",
  marginTop: 4,
  padding: 11,
  borderRadius: 10,
  border: "2px dashed var(--color-surface)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  color: "color-mix(in srgb, var(--foreground) 45%, transparent)",
  background: "transparent",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

/** An internal reference link (Alibaba/supplier listing, sourcing page, factory
 *  contact, etc.) — admin-only. Never sent to the storefront or any public API. */
export default function ProductPrivateLinksManager({ initialLinks, onChange }: Props) {
  const [links, setLinks] = useState<ProductPrivateLink[]>(initialLinks);

  function notify(next: ProductPrivateLink[]) {
    setLinks(next);
    onChange(next);
  }

  function add() {
    notify([...links, { id: genId(), label: "", url: "" }]);
  }

  function update(index: number, patch: Partial<ProductPrivateLink>) {
    notify(links.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function remove(index: number) {
    notify(links.filter((_, i) => i !== index));
  }

  return (
    <div>
      <p className={peStyles.hint} style={{ marginTop: 0, marginBottom: 12 }}>
        <Lock size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
        Internal only — supplier pages, sourcing listings, factory contacts. Never shown to customers or on the storefront.
      </p>

      {links.length === 0 && (
        <p className={peStyles.hint} style={{ textAlign: "center", padding: 14, border: "1.5px dashed var(--color-surface)", borderRadius: 10 }}>
          No private links yet.
        </p>
      )}

      <div>
        {links.map((link, i) => (
          <div key={link.id} style={cardStyle}>
            <div style={cardHeadStyle}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                {link.label?.trim() || `Link ${i + 1}`}
              </span>
              {link.url?.trim() && (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open link"
                  style={{ display: "flex", color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}
                >
                  <ExternalLink size={14} />
                </a>
              )}
              <button type="button" style={removeBtnStyle} onClick={() => remove(i)} title="Remove">
                <Trash2 size={15} />
              </button>
            </div>

            <div style={cardBodyStyle}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>Label</label>
                <input
                  value={link.label}
                  onChange={e => update(i, { label: e.target.value })}
                  placeholder="e.g. Alibaba supplier"
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={labelStyle}>URL</label>
                <input
                  type="url"
                  value={link.url}
                  onChange={e => update(i, { url: e.target.value })}
                  placeholder="https://www.alibaba.com/product-detail/…"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button type="button" style={addBtnStyle} onClick={add}>
        <Plus size={16} />
        <span>Add link</span>
      </button>
    </div>
  );
}
