"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { useToast } from "@/components/toast/ToastContext";

interface OptionValue {
  optionValueId: string;
  value: string;
  displayValue: string | null;
  attributeName: string;
}

interface InventoryRow {
  id: string;
  variantId: string;
  productId: string;
  sku: string;
  variantTitle: string;
  priceCents: number;
  compareAtPriceCents: number | null;
  featuredMediaUrl: string | null;
  optionValues: OptionValue[];
  productTitle: string;
  productStatus: string;
  available: number;
  reserved: number;
  committed: number;
  incoming: number;
  lowStockThreshold: number;
  updatedAt: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
}

interface Movement {
  id: string;
  type: string;
  delta: number;
  availableAfter: number;
  reservedAfter: number;
  committedAfter: number;
  note: string | null;
  createdAt: string;
}

const STATUS_BADGE: Record<InventoryRow["status"], string> = {
  in_stock: "badgeActive",
  low_stock: "badge",
  out_of_stock: "badgeInactive",
};

const STATUS_LABEL: Record<InventoryRow["status"], string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
};

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString(undefined, { style: "currency", currency: "EUR" });
}

const ADJUST_FORM_ID = "adjust-form";
const THRESHOLD_FORM_ID = "threshold-form";
const SKELETON_ROWS = 6;
const COLUMN_COUNT = 12;

export default function InventoryPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDelta, setBulkDelta] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<InventoryRow | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [movementsTarget, setMovementsTarget] = useState<InventoryRow | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  const [thresholdTarget, setThresholdTarget] = useState<InventoryRow | null>(null);
  const [thresholdValue, setThresholdValue] = useState("");
  const [thresholdSaving, setThresholdSaving] = useState(false);

  const [generateTarget, setGenerateTarget] = useState<{ productId: string } | null>(null);
  const [generateSaving, setGenerateSaving] = useState(false);

  const [copiedSku, setCopiedSku] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setRows(await api.get<InventoryRow[]>("/next-api/admin/shop/inventory"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const uniqueProducts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(r.productId, r.productTitle);
    return Array.from(seen.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (productFilter && r.productId !== productFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesOption = r.optionValues.some((o) => (o.displayValue ?? o.value).toLowerCase().includes(q));
        if (!r.productTitle.toLowerCase().includes(q) && !r.sku.toLowerCase().includes(q) && !r.variantTitle.toLowerCase().includes(q) && !matchesOption) {
          return false;
        }
      }
      return true;
    });
  }, [rows, search, statusFilter, productFilter]);

  const kpi = useMemo(
    () => ({
      available: rows.reduce((s, r) => s + r.available, 0),
      reserved: rows.reduce((s, r) => s + r.reserved, 0),
      committed: rows.reduce((s, r) => s + r.committed, 0),
      inStock: rows.filter((r) => r.status === "in_stock").length,
      lowStock: rows.filter((r) => r.status === "low_stock").length,
      outOfStock: rows.filter((r) => r.status === "out_of_stock").length,
      skus: rows.length,
    }),
    [rows],
  );

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.variantId));

  function toggleAll() {
    setSelected((prev) => {
      const s = new Set(prev);
      if (allSelected) filtered.forEach((r) => s.delete(r.variantId));
      else filtered.forEach((r) => s.add(r.variantId));
      return s;
    });
  }

  function toggleOne(variantId: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(variantId)) s.delete(variantId);
      else s.add(variantId);
      return s;
    });
  }

  function openAdjust(row: InventoryRow) {
    setDelta("");
    setNote("");
    setAdjustTarget(row);
  }

  async function handleAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adjustTarget) return;
    const deltaNum = Number(delta);
    if (!Number.isInteger(deltaNum) || deltaNum === 0) {
      toast.error("Invalid delta value");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/next-api/admin/shop/inventory/${adjustTarget.variantId}/adjust`, { delta: deltaNum, note: note || "Manual adjustment" });
      toast.success("Stock adjusted");
      setAdjustTarget(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to adjust stock"));
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkAdjust() {
    const deltaNum = Number(bulkDelta);
    if (!Number.isInteger(deltaNum) || deltaNum === 0 || selected.size === 0) {
      toast.error("Invalid delta value");
      return;
    }
    setBulkSaving(true);
    try {
      const adjustments = Array.from(selected).map((variantId) => ({ variantId, delta: deltaNum, note: bulkNote || "Bulk adjustment" }));
      const data = await api.post<{ ok: number; failed: number }>("/next-api/admin/shop/inventory/bulk-adjust", { adjustments });
      toast.success(`Adjusted ${data.ok} SKU(s)${data.failed > 0 ? `, ${data.failed} failed` : ""}`);
      setSelected(new Set());
      setBulkDelta("");
      setBulkNote("");
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Bulk adjustment failed"));
    } finally {
      setBulkSaving(false);
    }
  }

  async function openMovements(row: InventoryRow) {
    setMovementsTarget(row);
    setMovementsLoading(true);
    try {
      setMovements(await api.get<Movement[]>(`/next-api/admin/shop/inventory/${row.variantId}/movements`));
    } catch {
      toast.error("Failed to load movements");
    } finally {
      setMovementsLoading(false);
    }
  }

  function openThreshold(row: InventoryRow) {
    setThresholdValue(String(row.lowStockThreshold));
    setThresholdTarget(row);
  }

  async function handleThresholdSubmit(e: FormEvent) {
    e.preventDefault();
    if (!thresholdTarget) return;
    const val = Number(thresholdValue);
    if (!Number.isInteger(val) || val < 0) {
      toast.error("Invalid threshold");
      return;
    }
    setThresholdSaving(true);
    try {
      await api.patch(`/next-api/admin/shop/inventory/${thresholdTarget.variantId}`, { lowStockThreshold: val });
      toast.success("Threshold updated");
      setThresholdTarget(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to update threshold"));
    } finally {
      setThresholdSaving(false);
    }
  }

  function openGenerate() {
    const first = uniqueProducts[0];
    if (first) setGenerateTarget({ productId: first.id });
  }

  async function handleGenerate() {
    if (!generateTarget) return;
    setGenerateSaving(true);
    try {
      const res = await api.post<{ created: number; skipped: number }>(`/next-api/admin/shop/products/${generateTarget.productId}/variants/generate-combinations`);
      toast.success(`Generated ${res.created} new SKU(s), ${res.skipped} already existed`);
      setGenerateTarget(null);
      await load();
    } catch (err) {
      toast.error(errMessage(err, "Failed to generate combinations"));
    } finally {
      setGenerateSaving(false);
    }
  }

  function copySku(sku: string) {
    navigator.clipboard?.writeText(sku).then(() => {
      setCopiedSku(sku);
      toast.success("SKU copied");
      setTimeout(() => setCopiedSku((cur) => (cur === sku ? null : cur)), 1500);
    });
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Inventory</h1>
        <div className={ui.rowActions}>
          <Button variant="secondary" onClick={load} disabled={loading}>
            ↻ Refresh
          </Button>
          <Button onClick={openGenerate} disabled={uniqueProducts.length === 0}>
            + Generate Combinations
          </Button>
        </div>
      </div>

      <div className={ui.kpiStrip}>
        <div className={ui.kpiCard} title="Sellable stock — not held by any order">
          <span className={ui.kpiLabel}>Available units</span>
          <span className={ui.kpiValue}>{kpi.available.toLocaleString()}</span>
        </div>
        <div className={ui.kpiCard} title="Held for unpaid orders — released back to Available after the checkout window expires">
          <span className={ui.kpiLabel}>Reserved</span>
          <span className={ui.kpiValue}>{kpi.reserved.toLocaleString()}</span>
        </div>
        <div className={ui.kpiCard} title="Allocated to paid orders awaiting fulfillment">
          <span className={ui.kpiLabel}>Committed</span>
          <span className={ui.kpiValue}>{kpi.committed.toLocaleString()}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>In stock</span>
          <span className={ui.kpiValue}>{kpi.inStock}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Low stock</span>
          <span className={`${ui.kpiValue} ${kpi.lowStock > 0 ? ui.kpiWarn : ""}`}>{kpi.lowStock}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Out of stock</span>
          <span className={`${ui.kpiValue} ${kpi.outOfStock > 0 ? ui.kpiDanger : ""}`}>{kpi.outOfStock}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Total SKUs</span>
          <span className={ui.kpiValue}>{kpi.skus}</span>
        </div>
      </div>

      <div className={ui.toolbar}>
        <input className={ui.searchInput} placeholder="Search product, SKU, variant, options…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={ui.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="in_stock">In stock</option>
          <option value="low_stock">Low stock</option>
          <option value="out_of_stock">Out of stock</option>
        </select>
        <select className={ui.select} value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="">All products</option>
          {uniqueProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
        <span className={ui.muted} style={{ fontSize: "0.85rem" }}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {selected.size > 0 && (
        <div className={ui.bulkBar}>
          <span className={ui.bulkLabel}>{selected.size} selected</span>
          <input className={ui.bulkInput} type="number" step="1" placeholder="Delta (±)" value={bulkDelta} onChange={(e) => setBulkDelta(e.target.value)} />
          <input className={ui.bulkInput} placeholder="Note (optional)" value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} />
          <Button onClick={handleBulkAdjust} disabled={bulkSaving || !bulkDelta}>
            {bulkSaving ? "Applying…" : "Apply to selected"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSelected(new Set());
            }}
          >
            Clear
          </Button>
        </div>
      )}

      <div className={ui.card}>
        {loading ? (
          <table className={ui.table}>
            <thead>
              <tr>
                <th />
                <th />
                <th>Product</th>
                <th>SKU</th>
                <th>Options</th>
                <th>Price</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Committed</th>
                <th>Incoming</th>
                <th>Status</th>
                <th>Threshold</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: COLUMN_COUNT }, (__, j) => (
                    <td key={j}>
                      <span className={ui.skeletonCell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div className={ui.emptyState}>No variants with stock records yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th />
                <th>Product</th>
                <th>SKU</th>
                <th>Options</th>
                <th>Price</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Committed</th>
                <th>Incoming</th>
                <th>Status</th>
                <th>Threshold</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" checked={selected.has(r.variantId)} onChange={() => toggleOne(r.variantId)} aria-label={`Select ${r.sku}`} />
                  </td>
                  <td>
                    {r.featuredMediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.featuredMediaUrl} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} />
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--color-surface)" }} />
                    )}
                  </td>
                  <td>
                    {r.productTitle}
                    <div style={{ fontSize: "0.78rem", color: "var(--color-secondary)" }}>{r.variantTitle}</div>
                  </td>
                  <td>
                    {r.sku}
                    <button type="button" className={ui.iconBtn} title="Copy SKU" onClick={() => copySku(r.sku)}>
                      {copiedSku === r.sku ? "✓" : "⎘"}
                    </button>
                  </td>
                  <td style={{ fontSize: "0.82rem" }}>{r.optionValues.map((o) => o.displayValue ?? o.value).join(", ") || "—"}</td>
                  <td>
                    {formatPrice(r.priceCents)}
                    {r.compareAtPriceCents ? (
                      <div style={{ fontSize: "0.75rem", color: "var(--color-secondary)", textDecoration: "line-through" }}>{formatPrice(r.compareAtPriceCents)}</div>
                    ) : null}
                  </td>
                  <td>
                    <strong>{r.available}</strong>
                  </td>
                  <td>{r.reserved}</td>
                  <td>{r.committed}</td>
                  <td className={ui.muted}>{r.incoming > 0 ? `+${r.incoming}` : "—"}</td>
                  <td>
                    <span className={ui[STATUS_BADGE[r.status]]}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td>
                    <button type="button" className={ui.thresholdBtn} title="Edit low-stock threshold" onClick={() => openThreshold(r)}>
                      {r.lowStockThreshold}
                    </button>
                  </td>
                  <td className={ui.muted} style={{ fontSize: "0.78rem" }}>
                    {new Date(r.updatedAt).toLocaleDateString()}
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Button variant="secondary" onClick={() => openMovements(r)}>
                        History
                      </Button>
                      <Button onClick={() => openAdjust(r)}>Adjust</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjustTarget && (
        <Modal
          title={`Adjust stock — ${adjustTarget.productTitle}`}
          onClose={() => setAdjustTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setAdjustTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" form={ADJUST_FORM_ID} disabled={saving}>
                {saving ? "Saving…" : "Apply"}
              </Button>
            </>
          }
        >
          <form id={ADJUST_FORM_ID} onSubmit={handleAdjustSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>
              Currently <strong>{adjustTarget.available}</strong> available. Enter a positive number to add stock, or negative to remove.
            </p>
            <div className={ui.field}>
              <label className={ui.label}>Adjustment</label>
              <input className={ui.input} type="number" step="1" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="e.g. 20 or -5" required autoFocus />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Note</label>
              <input className={ui.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Restock from supplier" />
            </div>
          </form>
        </Modal>
      )}

      {thresholdTarget && (
        <Modal
          title={`Low-stock threshold — ${thresholdTarget.sku}`}
          onClose={() => setThresholdTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setThresholdTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" form={THRESHOLD_FORM_ID} disabled={thresholdSaving}>
                {thresholdSaving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <form id={THRESHOLD_FORM_ID} onSubmit={handleThresholdSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Alert when available drops below</label>
              <input className={ui.input} type="number" min={0} step="1" value={thresholdValue} onChange={(e) => setThresholdValue(e.target.value)} required autoFocus />
            </div>
          </form>
        </Modal>
      )}

      {generateTarget && (
        <Modal
          title="Generate Combinations"
          onClose={() => setGenerateTarget(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setGenerateTarget(null)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generateSaving}>
                {generateSaving ? "Generating…" : "Generate"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Product</label>
              <select
                className={ui.select}
                value={generateTarget.productId}
                onChange={(e) => setGenerateTarget({ productId: e.target.value })}
              >
                {uniqueProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>
              <strong>What this does:</strong>
              <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
                <li>Reads all variation attributes linked to this product</li>
                <li>Computes every possible option combination</li>
                <li>Creates missing SKUs with auto-generated titles</li>
                <li>Sets initial stock to 0 — update prices &amp; stock after</li>
                <li>Skips combinations that already exist</li>
              </ul>
            </div>
          </div>
        </Modal>
      )}

      {movementsTarget && (
        <Modal title={`Stock history — ${movementsTarget.productTitle}`} onClose={() => setMovementsTarget(null)}>
          {movementsLoading ? (
            <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>Loading…</p>
          ) : movements.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--color-secondary)" }}>No movements recorded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxHeight: 360, overflowY: "auto" }}>
              {movements.map((m) => (
                <div key={m.id} style={{ borderBottom: "1px solid var(--color-surface)", paddingBottom: "0.6rem", fontSize: "0.85rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 600, color: "var(--color-primary)" }}>{m.type.replace(/_/g, " ")}</span>
                    <span style={{ color: m.delta >= 0 ? "#166534" : "#991b1b" }}>{m.delta >= 0 ? `+${m.delta}` : m.delta}</span>
                  </div>
                  {m.note && <div style={{ color: "var(--color-secondary)" }}>{m.note}</div>}
                  <div style={{ color: "var(--color-secondary)", fontSize: "0.75rem" }}>
                    {new Date(m.createdAt).toLocaleString()} · available: {m.availableAfter}, reserved: {m.reservedAfter}, committed: {m.committedAfter}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
