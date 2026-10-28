"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import Select, { type SelectOption } from "@/components/admin/ui/Select";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface StoreBrandOption {
  id: string;
  name: string;
  isActive: boolean;
}

const SILOMIS = "__silomis__";

/** Which brand a product is sold under: Silomis, or one of the neutral brands. */
export default function StoreBrandSelect({ value, onChange }: { value: string | null | undefined; onChange: (storeBrandId: string | null) => void }) {
  const [brands, setBrands] = useState<StoreBrandOption[] | null>(null);

  useEffect(() => {
    api
      .get<StoreBrandOption[]>("/next-api/admin/shop/store-brands")
      .then(setBrands)
      .catch(() => setBrands([]));
  }, []);

  const options: SelectOption[] = [
    { value: SILOMIS, label: "Silomis", description: "Sold as Silomis." },
    ...(brands ?? []).map((b) => ({
      value: b.id,
      label: b.name,
      description: b.isActive ? "Its own logo, footer, pages, emails and texts." : "Switched off — shown as Silomis until it is turned on.",
    })),
  ];

  return (
    <div className={ui.field}>
      <label className={ui.label}>Sold under</label>
      <Select value={value ?? SILOMIS} options={options} onChange={(v) => onChange(v === SILOMIS ? null : v)} disabled={brands === null} ariaLabel="Sold under" />
      <span style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>
        {brands?.length === 0 ? "No neutral brand yet. " : ""}
        <Link href={value ? `/admin/shop/brands/${value}` : "/admin/shop/brands"}>{value ? "Edit this brand" : "Manage neutral brands"}</Link>
      </span>
    </div>
  );
}
