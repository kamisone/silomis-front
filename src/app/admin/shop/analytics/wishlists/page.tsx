"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface MostWishlisted {
  productId: string;
  count: number;
  product: { id: string; title: string; slug: string } | null;
}

interface NonConverting {
  id: string;
  productId: string;
  userId: string | null;
  addedAt: string;
  product: { id: string; title: string; slug: string } | null;
}

export default function WishlistAnalyticsPage() {
  const [mostWishlisted, setMostWishlisted] = useState<MostWishlisted[]>([]);
  const [nonConverting, setNonConverting] = useState<NonConverting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<MostWishlisted[]>("/next-api/admin/shop/wishlists/most-wishlisted?limit=20"),
      api.get<NonConverting[]>("/next-api/admin/shop/wishlists/non-converting?limit=20"),
    ])
      .then(([most, nonConv]) => {
        setMostWishlisted(most);
        setNonConverting(nonConv);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Wishlist analytics</h1>
      </div>

      <div className={ui.card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Most wishlisted</h2>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : mostWishlisted.length === 0 ? (
          <div className={ui.emptyState}>No wishlist activity yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Times wishlisted</th>
              </tr>
            </thead>
            <tbody>
              {mostWishlisted.map((r) => (
                <tr key={r.productId}>
                  <td>{r.product ? <Link href={`/admin/shop/products/${r.product.id}`}>{r.product.title}</Link> : r.productId}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={ui.card}>
        <h2 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "0.75rem" }}>Wishlisted, never purchased</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)", marginTop: "-0.5rem" }}>
          Only covers known-customer wishlist rows — guest wishlist activity has no reliable link to a completed order.
        </p>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : nonConverting.length === 0 ? (
          <div className={ui.emptyState}>Nothing to show — no known-customer wishlist activity yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Added</th>
              </tr>
            </thead>
            <tbody>
              {nonConverting.map((r) => (
                <tr key={r.id}>
                  <td>{r.product ? <Link href={`/admin/shop/products/${r.product.id}`}>{r.product.title}</Link> : r.productId}</td>
                  <td>{new Date(r.addedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
