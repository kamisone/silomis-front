"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface CartItem {
  id: string;
  titleSnapshot: string;
  skuSnapshot: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  imageUrl: string | null;
  compareAtPriceCentsSnapshot: number | null;
  optionsSnapshot: Array<{ attributeName: string; displayValue: string | null; value: string }> | null;
}

interface CartRow {
  id: string;
  token: string;
  userId: string | null;
  status: "active" | "abandoned" | "completed" | "merged";
  items: CartItem[];
  expiresAt: string | null;
  updatedAt: string;
}

interface CartStats {
  byStatus: Record<CartRow["status"], number>;
  abandonedValueCents: number;
}

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

const STATUS_BADGE: Record<CartRow["status"], string> = {
  active: "badgeActive",
  abandoned: "badge",
  completed: "badgeActive",
  merged: "badgeInactive",
};

function expiresLabel(iso: string | null): { text: string; expired: boolean } {
  if (!iso) return { text: "—", expired: false };
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return { text: "Expired", expired: true };
  const day = Math.floor(diffMs / 86_400_000);
  if (day >= 1) return { text: `in ${day}d`, expired: false };
  const hr = Math.max(1, Math.floor(diffMs / 3_600_000));
  return { text: `in ${hr}h`, expired: false };
}

const LIMIT = 20;

export default function CartsPage() {
  const [carts, setCarts] = useState<CartRow[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<CartStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<CartRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String((page - 1) * LIMIT) });
      if (statusFilter) params.set("status", statusFilter);
      const data = await api.get<{ items: CartRow[]; total: number; stats: CartStats }>(`/next-api/admin/shop/carts?${params.toString()}`);
      setCarts(data.items);
      setTotal(data.total);
      setStats(data.stats);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  function cartValue(cart: CartRow): number {
    return cart.items.reduce((sum, i) => sum + i.lineTotalCents, 0);
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Carts {total > 0 && <span style={{ color: "var(--color-secondary)", fontWeight: 400 }}>({total})</span>}</h1>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {(Object.keys(stats.byStatus) as CartRow["status"][]).map((s) => (
            <div key={s} className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 130 }}>
              <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textTransform: "capitalize" }}>{s}</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{stats.byStatus[s]}</div>
            </div>
          ))}
          <div className={ui.card} style={{ padding: "1rem 1.25rem", minWidth: 180, background: "var(--color-surface-tint)" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)" }}>Value at risk (abandoned)</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-primary)" }}>{eur(stats.abandonedValueCents)}</div>
          </div>
        </div>
      )}

      <div className={ui.toolbar}>
        <select className={ui.select} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="abandoned">Abandoned</option>
          <option value="completed">Completed</option>
          <option value="merged">Merged</option>
        </select>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : carts.length === 0 ? (
          <div className={ui.emptyState}>No carts yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Items</th>
                <th>Value</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {carts.map((c) => {
                const exp = expiresLabel(c.expiresAt);
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontSize: "0.85rem" }}>{c.userId ? `${c.userId.slice(0, 8)}…` : "Guest"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "var(--color-secondary)" }}>
                        {c.token.slice(0, 8)}…
                      </div>
                    </td>
                    <td>{c.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td>{eur(cartValue(c))}</td>
                    <td>
                      <span className={ui[STATUS_BADGE[c.status]]}>{c.status}</span>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: exp.expired ? "var(--color-danger, #dc2626)" : "var(--color-secondary)" }}>
                      {exp.text}
                    </td>
                    <td>{new Date(c.updatedAt).toLocaleString()}</td>
                    <td>
                      <Button variant="secondary" onClick={() => setDetail(c)}>
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", justifyContent: "flex-end" }}>
          <span style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>{total} carts</span>
          <Button variant="secondary" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span style={{ fontSize: "0.85rem" }}>
            Page {page} / {pages}
          </span>
          <Button variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {detail && (
        <Modal title={`Cart ${detail.token.slice(0, 8)}…`} onClose={() => setDetail(null)}>
          {detail.items.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>This cart is empty.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {detail.items.map((i) => (
                <div key={i.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", borderBottom: "1px solid var(--color-surface)", paddingBottom: "0.6rem" }}>
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 44, height: 44, borderRadius: 6, background: "var(--color-surface)" }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{i.titleSnapshot}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--color-secondary)" }}>
                      {i.skuSnapshot} · Qty {i.quantity} ×{" "}
                      {i.compareAtPriceCentsSnapshot && i.compareAtPriceCentsSnapshot > i.unitPriceCents ? (
                        <>
                          <span style={{ textDecoration: "line-through", marginRight: 4 }}>
                            {eur(i.compareAtPriceCentsSnapshot)}
                          </span>
                          {eur(i.unitPriceCents)}
                        </>
                      ) : (
                        eur(i.unitPriceCents)
                      )}
                    </div>
                    {i.optionsSnapshot && i.optionsSnapshot.length > 0 && (
                      <div style={{ fontSize: "0.72rem", color: "var(--color-secondary)", marginTop: 2 }}>
                        {i.optionsSnapshot.map((o, idx) => (
                          <span key={idx} style={{ marginRight: 8 }}>
                            {o.attributeName}: {o.displayValue ?? o.value}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ fontWeight: 600 }}>{eur(i.lineTotalCents)}</div>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, paddingTop: "0.25rem" }}>
                <span>Total</span>
                <span>{eur(cartValue(detail))}</span>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
