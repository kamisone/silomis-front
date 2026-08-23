"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface CustomerListItem {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  totalOrders: number;
  totalSpentCents: number;
  createdAt: string;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function CustomersPage() {
  const [items, setItems] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const data = await api.get<{ items: CustomerListItem[]; total: number }>(`/next-api/admin/shop/customers?${params.toString()}`);
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
        <h1 className={ui.pageTitle}>Customers {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      <div className={ui.toolbar}>
        <input className={ui.searchInput} placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : items.length === 0 ? (
          <div className={ui.emptyState}>No customers yet — they're created automatically when someone checks out.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Orders</th>
                <th>Total spent</th>
                <th>Since</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/shop/customers/${c.id}`} style={{ fontWeight: 600, color: "var(--color-primary)" }}>
                      {c.firstName || c.lastName ? `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() : "—"}
                    </Link>
                  </td>
                  <td>{c.email}</td>
                  <td>{c.totalOrders}</td>
                  <td>{eur(c.totalSpentCents)}</td>
                  <td>{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
