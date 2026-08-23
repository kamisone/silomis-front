"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface AddressListItem {
  id: string;
  customerId: string;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  zip: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
  customer: { id: string; email: string; firstName: string | null; lastName: string | null };
}

export default function CustomerAddressesPage() {
  const [items, setItems] = useState<AddressListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      const data = await api.get<{ items: AddressListItem[]; total: number }>(`/next-api/admin/shop/customers/addresses?${params.toString()}`);
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Addresses {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.toolbar}>
        <input className={ui.searchInput} placeholder="Search by customer email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No addresses saved yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Name</th>
                <th>Address</th>
                <th>City</th>
                <th>Country</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <Link href={`/admin/shop/customers/${a.customer.id}`} style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                      {a.customer.email}
                    </Link>
                  </td>
                  <td>{a.name}</td>
                  <td>
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}
                  </td>
                  <td>
                    {a.city} {a.zip}
                  </td>
                  <td>{a.country}</td>
                  <td>{a.isDefault ? <span className={ui.badgeActive}>Default</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
