"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";

type ReturnStatus = "requested" | "approved" | "rejected" | "refunded" | "restocked";

interface OrderItemLite {
  id: string;
  titleSnapshot: string;
  quantity: number;
  unitPriceCents: number;
}

interface OrderLite {
  id: string;
  orderNumber: string;
  customerEmail: string;
  items: OrderItemLite[];
}

interface ReturnRequestItem {
  id: string;
  orderItemId: string;
  quantity: number;
  restocked: boolean;
  orderItem: OrderItemLite;
}

interface ReturnRequest {
  id: string;
  orderId: string;
  customerEmail: string;
  status: ReturnStatus;
  reason: string | null;
  adminNote: string | null;
  restockOnComplete: boolean;
  refundedAmountCents: number | null;
  createdAt: string;
  items: ReturnRequestItem[];
  order?: { orderNumber: string };
}

const STATUS_LABEL: Record<ReturnStatus, string> = { requested: "Requested", approved: "Approved", rejected: "Rejected", refunded: "Refunded", restocked: "Restocked" };

function eur(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderResults, setOrderResults] = useState<OrderLite[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderLite | null>(null);
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [restockOnComplete, setRestockOnComplete] = useState(true);
  const [saving, setSaving] = useState(false);

  const [detail, setDetail] = useState<ReturnRequest | null>(null);
  const [acting, setActing] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await api.get<{ items: ReturnRequest[]; total: number }>(`/next-api/admin/shop/returns?${params.toString()}`);
      setReturns(res.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function searchOrders() {
    if (!orderSearch.trim()) return;
    const res = await api.get<{ items: OrderLite[]; total: number }>(`/next-api/admin/shop/orders?search=${encodeURIComponent(orderSearch)}&limit=10`);
    setOrderResults(res.items);
  }

  function pickOrder(order: OrderLite) {
    setSelectedOrder(order);
    setReturnQty(Object.fromEntries(order.items.map((i) => [i.id, 0])));
  }

  function openCreate() {
    setError(null);
    setOrderSearch("");
    setOrderResults([]);
    setSelectedOrder(null);
    setReturnQty({});
    setReason("");
    setRestockOnComplete(true);
    setCreating(true);
  }

  function closeCreate() {
    setCreating(false);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!selectedOrder) return;
    const items = Object.entries(returnQty)
      .filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
    if (items.length === 0) {
      setError("Select at least one item to return");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post("/next-api/admin/shop/returns", { orderId: selectedOrder.id, items, reason: reason || null, restockOnComplete });
      closeCreate();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Create failed") : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(r: ReturnRequest) {
    setError(null);
    const full = await api.get<ReturnRequest>(`/next-api/admin/shop/returns/${r.id}`);
    setDetail(full);
  }

  async function transition(status: ReturnStatus) {
    if (!detail) return;
    setActing(true);
    setError(null);
    try {
      const updated = await api.patch<ReturnRequest>(`/next-api/admin/shop/returns/${detail.id}/status`, { status });
      setDetail(updated);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Action failed") : "Action failed");
    } finally {
      setActing(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Returns &amp; refunds</h1>
        <Button onClick={openCreate}>New return</Button>
      </div>

      <div className={ui.toolbar}>
        <select className={ui.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : returns.length === 0 ? (
          <div className={ui.emptyState}>No return requests yet. Manual refunds can still be issued directly from the order or transaction detail.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {returns.map((r) => (
                <tr key={r.id}>
                  <td>{r.order?.orderNumber ?? r.orderId}</td>
                  <td>{r.customerEmail}</td>
                  <td>{r.items.reduce((sum, i) => sum + i.quantity, 0)}</td>
                  <td>
                    <span className={ui.badge}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Button variant="secondary" onClick={() => openDetail(r)}>
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <Modal
          title="New return"
          onClose={closeCreate}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={closeCreate}>
                Cancel
              </Button>
              <Button type="submit" form="new-return-form" disabled={saving || !selectedOrder}>
                {saving ? "Creating…" : "Create return"}
              </Button>
            </>
          }
        >
          <form id="new-return-form" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {error && <p className={ui.error}>{error}</p>}

            {!selectedOrder ? (
              <>
                <div className={ui.field}>
                  <label className={ui.label}>Find order by number or customer email</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      className={ui.input}
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), searchOrders())}
                      autoFocus
                    />
                    <Button type="button" onClick={searchOrders}>
                      Search
                    </Button>
                  </div>
                </div>
                {orderResults.length > 0 && (
                  <div className={ui.chipList}>
                    {orderResults.map((o) => (
                      <button key={o.id} type="button" className={ui.chip} onClick={() => pickOrder(o)} style={{ cursor: "pointer" }}>
                        {o.orderNumber} — {o.customerEmail}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p style={{ fontSize: "0.85rem" }}>
                  Order <strong>{selectedOrder.orderNumber}</strong> — {selectedOrder.customerEmail}{" "}
                  <button type="button" onClick={() => setSelectedOrder(null)} style={{ marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                    change
                  </button>
                </p>
                <table className={ui.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Ordered</th>
                      <th>Return qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.titleSnapshot}</td>
                        <td>{item.quantity}</td>
                        <td>
                          <input
                            className={ui.input}
                            type="number"
                            min={0}
                            max={item.quantity}
                            value={returnQty[item.id] ?? 0}
                            onChange={(e) => setReturnQty({ ...returnQty, [item.id]: Math.max(0, Math.min(item.quantity, parseInt(e.target.value || "0", 10))) })}
                            style={{ width: "5rem" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className={ui.field}>
                  <label className={ui.label}>Reason (optional)</label>
                  <textarea className={ui.textarea} value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>

                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
                  <input type="checkbox" checked={restockOnComplete} onChange={(e) => setRestockOnComplete(e.target.checked)} />
                  Restock these items once refunded
                </label>
              </>
            )}
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title={`Return — ${detail.order?.orderNumber ?? detail.orderId}`} onClose={() => setDetail(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {error && <p className={ui.error}>{error}</p>}

            <p>
              Status: <span className={ui.badge}>{STATUS_LABEL[detail.status]}</span>
            </p>
            <p style={{ fontSize: "0.85rem" }}>Customer: {detail.customerEmail}</p>
            {detail.reason && <p style={{ fontSize: "0.85rem" }}>Reason: {detail.reason}</p>}

            <table className={ui.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Restocked</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.orderItem.titleSnapshot}</td>
                    <td>{i.quantity}</td>
                    <td>{i.restocked ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {detail.refundedAmountCents !== null && <p style={{ fontSize: "0.85rem" }}>Refunded: {eur(detail.refundedAmountCents)}</p>}

            <div className={ui.rowActions}>
              {detail.status === "requested" && (
                <>
                  <Button disabled={acting} onClick={() => transition("approved")}>
                    Approve
                  </Button>
                  <Button variant="danger" disabled={acting} onClick={() => transition("rejected")}>
                    Reject
                  </Button>
                </>
              )}
              {detail.status === "approved" && (
                <Button disabled={acting} onClick={() => transition("refunded")}>
                  {acting ? "Refunding…" : "Issue refund"}
                </Button>
              )}
              {detail.status === "refunded" && detail.restockOnComplete && (
                <Button disabled={acting} onClick={() => transition("restocked")}>
                  Mark restocked
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
