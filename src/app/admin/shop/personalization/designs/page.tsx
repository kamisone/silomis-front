"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDown, ArrowUp, Check, FolderPlus, Layers, Loader2, Plus, Search, Shapes, Trash2, Upload, X,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import LocalizedTextField, { type LocalizedTextMap, toLocalizedMap } from "@/components/admin/ui/LocalizedTextField";
import Select from "@/components/admin/ui/Select";
import Switch from "@/components/admin/ui/Switch";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./designs.module.css";

const TRANSLATE_TEXT = "/next-api/admin/shop/translate/text";
const MOTIFS = "/next-api/admin/shop/personalization/motifs";
const CATEGORIES = "/next-api/admin/shop/personalization/motif-categories";

/** What the server stores for one shape. `transform` only when the file placed it with one. */
interface Shape {
  d: string;
  fill: string;
  transform?: string;
}

interface Design {
  id: string;
  key: string;
  name: LocalizedTextMap | string;
  path: string;
  viewBox: string;
  /** Every shape of the design; null for one of the older seeded silhouettes. */
  paths: Shape[] | null;
  /** Sewn in those shapes' own fills, rather than in a spool the customer picks. */
  ownColours: boolean;
  /** What picking this design adds to the embroidery price, in cents. */
  priceCents: number;
  colorCount: number;
  categoryId: string | null;
  categoryKey: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface Tab {
  id: string;
  key: string;
  name: LocalizedTextMap | string;
  isActive: boolean;
  sortOrder: number;
  _count: { motifs: number };
}

/** What the parse endpoint gives back — exactly what a save would store. */
interface ParsedArtwork {
  viewBox: string;
  shapes: Shape[];
  path: string;
  colorCount: number;
}

const UNFILED = "__none__";

/** Cents as the admin reads them. */
function euros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** What the admin typed, as cents. A blank or a nonsense figure is no surcharge. */
function toCents(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}

/** Message from a coded 400, or a fallback — the API names the real problem. */
function apiMessage(err: unknown, fallback: string): string {
  const body = err instanceof ApiError ? (err.body as { message?: string | string[] }) : null;
  const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
  return message || fallback;
}

/** The English name, or the first language written, or the key — for lists and search. */
function plainName(value: LocalizedTextMap | string, fallback: string): string {
  const map = toLocalizedMap(value);
  return map.en || Object.values(map).find(Boolean) || fallback;
}

/**
 * Draws a design the way the storefront will.
 *
 * Not the uploaded file — the parsed shapes. The two differ whenever something
 * in the file cannot be stitched, and that difference is the whole reason an
 * admin looks at this preview before saving.
 */
function DesignArt({
  viewBox,
  shapes,
  flatShapes,
  path,
  size = 44,
}: {
  viewBox: string;
  /** Shapes drawn in their own fills — a design that keeps its colours. */
  shapes?: Shape[] | null;
  /** The same shapes drawn in one colour, which is what a chosen spool does to them. */
  flatShapes?: Shape[] | null;
  /** The single silhouette of an older seeded design, which has no shapes. */
  path?: string;
  size?: number;
}) {
  const flat = !shapes?.length && flatShapes?.length ? flatShapes : null;
  return (
    <svg viewBox={viewBox} width={size} height={size} className={styles.art} aria-hidden="true">
      {shapes?.length
        ? shapes.map((s, i) => <path key={i} d={s.d} fill={s.fill} transform={s.transform} />)
        : flat
          ? flat.map((s, i) => <path key={i} d={s.d} fill="currentColor" transform={s.transform} />)
          : path
            ? <path d={path} fill="currentColor" />
            : null}
    </svg>
  );
}

/**
 * The design library: the shapes a customer can have stitched instead of words,
 * and the tabs they are filed under.
 *
 * Both are the shop's own merchandising — a headwear shop leads with Sport
 * where a christening shop leads with Baptism — so neither is compiled into the
 * storefront. A design is uploaded as an SVG and stored as its shapes, never as
 * the file: the storefront and the production sheet both draw it from a `d` and
 * a colour, so there is no markup anywhere to sanitise.
 */
export default function DesignLibraryPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [tabsOpen, setTabsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, t] = await Promise.all([api.get<Design[]>(MOTIFS), api.get<Tab[]>(CATEGORIES)]);
      setDesigns(d);
      setTabs(t);
    } catch {
      setError("Could not load the design library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs one write, then reloads — the list's order and counts both move with it. */
  const run = useCallback(
    async (job: () => Promise<unknown>, fallback: string): Promise<boolean> => {
      setSaving(true);
      setError("");
      try {
        await job();
        await load();
        return true;
      } catch (err) {
        setError(apiMessage(err, fallback));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  /** Tab name by id, for the line under each design. */
  const tabName = useMemo(() => new Map(tabs.map((t) => [t.id, plainName(t.name, t.key)])), [tabs]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const inFilter = (d: Design) => (filter === "all" ? true : filter === UNFILED ? !d.categoryId : d.categoryId === filter);
    const matches = (d: Design) => !q || `${d.key} ${plainName(d.name, "")}`.toLowerCase().includes(q);
    return designs.filter((d) => inFilter(d) && matches(d));
  }, [designs, search, filter]);

  const tabOptions = useMemo(
    () => [
      { value: UNFILED, label: "No tab", description: "Shows only under “All”." },
      ...tabs.map((t) => ({ value: t.id, label: plainName(t.name, t.key), description: t.isActive ? undefined : "This tab is switched off." })),
    ],
    [tabs],
  );

  /** Swaps a design with its neighbour — this order is the order in the editor. */
  const move = useCallback(
    async (list: { id: string; sortOrder: number }[], index: number, delta: -1 | 1, endpoint: string) => {
      const a = list[index];
      const b = list[index + delta];
      if (!a || !b) return;
      await run(
        () =>
          Promise.all([
            api.patch(`${endpoint}/${a.id}`, { sortOrder: b.sortOrder }),
            api.patch(`${endpoint}/${b.id}`, { sortOrder: a.sortOrder }),
          ]),
        "Could not reorder those.",
      );
    },
    [run],
  );

  const activeCount = designs.filter((d) => d.isActive).length;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Design library</h1>
          <p className={ui.pageHint}>
            The shapes a customer can have stitched instead of a name. Upload each one as an SVG — it is stored as its
            shapes, at the size it is drawn, so it scales to any millimetre size without going fuzzy. The tabs below are
            yours to name and reorder.
          </p>
        </div>
      </div>

      {error && (
        <p className={ui.error}>
          <AlertTriangle size={14} aria-hidden="true" /> {error}
        </p>
      )}

      <div className={ui.kpiStrip}>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Offered</span>
          <span className={ui.kpiValue}>{activeCount}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>In the library</span>
          <span className={ui.kpiValue}>{designs.length}</span>
        </div>
        <div className={ui.kpiCard}>
          <span className={ui.kpiLabel}>Tabs</span>
          <span className={ui.kpiValue}>{tabs.length}</span>
        </div>
      </div>

      <TabManager
        tabs={tabs}
        open={tabsOpen}
        onToggle={() => setTabsOpen((v) => !v)}
        saving={saving}
        onCreate={(body) => run(() => api.post(CATEGORIES, body), "Could not add that tab.")}
        onPatch={(id, body) => run(() => api.patch(`${CATEGORIES}/${id}`, body), "Could not save that tab.")}
        onDelete={(t) =>
          run(async () => {
            await api.delete(`${CATEGORIES}/${t.id}`);
          }, "Could not remove that tab.")
        }
        onMove={(index, delta) => move(tabs, index, delta, CATEGORIES)}
      />

      <div className={ui.toolbar}>
        <button type="button" className={styles.primaryBtn} onClick={() => setAdding((v) => !v)}>
          <Plus size={14} aria-hidden="true" /> Add a design
        </button>
        <div className={styles.searchWrap}>
          <Search size={15} aria-hidden="true" className={styles.searchIcon} />
          <input className={ui.searchInput} placeholder="Name or key…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select
          className={styles.filterSelect}
          value={filter}
          onChange={setFilter}
          ariaLabel="Filter by tab"
          options={[
            { value: "all", label: `All tabs (${designs.length})` },
            ...tabs.map((t) => ({ value: t.id, label: `${plainName(t.name, t.key)} (${t._count.motifs})` })),
            { value: UNFILED, label: `No tab (${designs.filter((d) => !d.categoryId).length})` },
          ]}
        />
      </div>

      {adding && (
        <AddDesign
          tabOptions={tabOptions}
          saving={saving}
          onCancel={() => setAdding(false)}
          onCreate={async (body) => {
            const ok = await run(() => api.post(MOTIFS, body), "Could not add that design.");
            if (ok) setAdding(false);
            return ok;
          }}
        />
      )}

      {loading ? (
        <p className={ui.muted}>Loading…</p>
      ) : !visible.length ? (
        <div className={ui.emptyState}>
          <p>
            {search || filter !== "all"
              ? "No design matches that."
              : "No designs yet — upload the first SVG and it appears in the editor's Designs tab."}
          </p>
        </div>
      ) : (
        <ul className={styles.grid}>
          {visible.map((d) => {
            const index = designs.findIndex((x) => x.id === d.id);
            return (
              <li key={d.id} className={`${styles.card} ${d.isActive ? "" : styles.cardOff} ${editingId === d.id ? styles.cardEditing : ""}`}>
                {editingId === d.id ? (
                  <EditDesign
                    design={d}
                    tabOptions={tabOptions}
                    saving={saving}
                    onCancel={() => setEditingId("")}
                    onSave={async (body) => {
                      const ok = await run(() => api.patch(`${MOTIFS}/${d.id}`, body), "Could not save that design.");
                      if (ok) setEditingId("");
                    }}
                  />
                ) : (
                  <>
                    <button type="button" className={styles.artBtn} onClick={() => setEditingId(d.id)} aria-label={`Edit ${plainName(d.name, d.key)}`}>
                      {/* Drawn as it is sewn: its own fills, or every shape in one colour. */}
                      <DesignArt
                        viewBox={d.viewBox}
                        shapes={d.ownColours ? d.paths : null}
                        flatShapes={d.ownColours ? null : d.paths}
                        path={d.path}
                        size={52}
                      />
                    </button>
                    <div className={styles.cardMeta}>
                      <strong className={styles.cardName}>{plainName(d.name, d.key)}</strong>
                      <span className={styles.cardSub}>
                        {(d.categoryId && tabName.get(d.categoryId)) || "No tab"}
                        {" · "}
                        {d.ownColours ? `${d.colorCount} colours` : "one spool"}
                        {d.priceCents > 0 ? ` · +€${euros(d.priceCents)}` : ""}
                      </span>
                    </div>
                    <div className={styles.cardActions}>
                      {/* This order is the order in the storefront's grid, so
                          the designs a shop leads with are its own choice. */}
                      <button type="button" className={styles.iconBtn} onClick={() => move(designs, index, -1, MOTIFS)} disabled={saving || index === 0} title="Move up">
                        <ArrowUp size={12} aria-hidden="true" />
                      </button>
                      <button type="button" className={styles.iconBtn} onClick={() => move(designs, index, 1, MOTIFS)} disabled={saving || index === designs.length - 1} title="Move down">
                        <ArrowDown size={12} aria-hidden="true" />
                      </button>
                      <label className={styles.activeToggle} title={d.isActive ? "Offered to customers" : "Hidden from customers"}>
                        <input
                          type="checkbox"
                          checked={d.isActive}
                          disabled={saving}
                          onChange={(e) => run(() => api.patch(`${MOTIFS}/${d.id}`, { isActive: e.target.checked }), "Could not save that design.")}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        disabled={saving}
                        title="Remove"
                        onClick={() => {
                          if (!window.confirm(`Remove “${plainName(d.name, d.key)}”? Orders already placed keep their own copy of it.`)) return;
                          void run(() => api.delete(`${MOTIFS}/${d.id}`), "Could not remove that design.");
                        }}
                      >
                        <Trash2 size={12} aria-hidden="true" />
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────────────

/**
 * The tabs, folded away.
 *
 * A shop sets these up once and then spends its time on the designs, so the
 * panel opens closed — but it sits above the grid rather than on its own screen,
 * because "which tab does this go under" is a question asked while looking at
 * the designs.
 */
function TabManager({
  tabs, open, onToggle, saving, onCreate, onPatch, onDelete, onMove,
}: {
  tabs: Tab[];
  open: boolean;
  onToggle: () => void;
  saving: boolean;
  onCreate: (body: { name: LocalizedTextMap }) => Promise<boolean>;
  onPatch: (id: string, body: { name?: LocalizedTextMap; isActive?: boolean }) => Promise<boolean>;
  onDelete: (t: Tab) => Promise<boolean>;
  onMove: (index: number, delta: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState<LocalizedTextMap>({});

  return (
    <section className={styles.panel}>
      <header className={styles.panelHead}>
        <div>
          <h2 className={styles.panelTitle}>
            <Layers size={15} aria-hidden="true" /> Tabs
          </h2>
          <p className={styles.panelHint}>
            The chips above the designs in the editor. “All” is always there and is not one of these. A tab appears to
            customers only once it holds a design.
          </p>
        </div>
        <button type="button" className={styles.ghostBtn} onClick={onToggle}>
          {open ? "Close" : "Edit"}
        </button>
      </header>

      {!open ? (
        <div className={styles.chipRow}>
          {tabs.length ? (
            tabs.map((t) => (
              <span key={t.id} className={`${styles.chip} ${t.isActive ? "" : styles.chipOff}`}>
                {plainName(t.name, t.key)}
                <span className={styles.chipCount}>{t._count.motifs}</span>
              </span>
            ))
          ) : (
            <span className={ui.muted}>No tabs yet — every design shows under “All”.</span>
          )}
        </div>
      ) : (
        <div className={styles.panelBody}>
          {tabs.map((t, i) => (
            <div key={t.id} className={`${styles.tabRow} ${t.isActive ? "" : styles.tabRowOff}`}>
              <div className={styles.tabField}>
                <LocalizedTextField
                  label={`Name — ${t.key}`}
                  value={toLocalizedMap(t.name)}
                  onCommit={(name) => void onPatch(t.id, { name })}
                  translateEndpoint={TRANSLATE_TEXT}
                  maxLength={60}
                />
              </div>
              <div className={styles.tabActions}>
                <span className={styles.tabCount}>{t._count.motifs} designs</span>
                <button type="button" className={styles.iconBtn} onClick={() => onMove(i, -1)} disabled={saving || i === 0} title="Move left">
                  <ArrowUp size={12} aria-hidden="true" />
                </button>
                <button type="button" className={styles.iconBtn} onClick={() => onMove(i, 1)} disabled={saving || i === tabs.length - 1} title="Move right">
                  <ArrowDown size={12} aria-hidden="true" />
                </button>
                <label className={styles.activeToggle} title={t.isActive ? "Shown to customers" : "Hidden from customers"}>
                  <input type="checkbox" checked={t.isActive} disabled={saving} onChange={(e) => void onPatch(t.id, { isActive: e.target.checked })} />
                </label>
                <button
                  type="button"
                  className={styles.iconBtn}
                  disabled={saving}
                  title="Remove"
                  onClick={() => {
                    const warning = t._count.motifs
                      ? `Remove the “${plainName(t.name, t.key)}” tab? Its ${t._count.motifs} design(s) are kept — they move to “No tab” and show only under “All”.`
                      : `Remove the “${plainName(t.name, t.key)}” tab?`;
                    if (window.confirm(warning)) void onDelete(t);
                  }}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}

          <div className={styles.tabAdd}>
            <LocalizedTextField
              label="New tab"
              hint="Write English, then Generate the rest. The key is made from the English name and never changes."
              value={draft}
              onCommit={setDraft}
              translateEndpoint={TRANSLATE_TEXT}
              maxLength={60}
            />
            <button
              type="button"
              className={styles.primaryBtn}
              disabled={saving || !Object.values(toLocalizedMap(draft)).some(Boolean)}
              onClick={async () => {
                if (await onCreate({ name: draft })) setDraft({});
              }}
            >
              <FolderPlus size={14} aria-hidden="true" /> Add tab
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Uploading ──────────────────────────────────────────────────────────

/**
 * Reads an SVG in the browser and asks the server what it makes of it, before
 * anything is stored. What comes back is drawn as the preview, so the admin
 * approves the shapes that will actually be sewn rather than the file their
 * browser happens to render.
 */
function useSvgUpload() {
  const [svg, setSvg] = useState("");
  const [parsed, setParsed] = useState<ParsedArtwork | null>(null);
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  /** Guards against an earlier, slower parse landing after a later one. */
  const latest = useRef(0);

  const take = useCallback(async (text: string) => {
    const ticket = ++latest.current;
    setSvg(text);
    setParsed(null);
    setProblem("");
    if (!text.trim()) return;
    setBusy(true);
    try {
      const art = await api.post<ParsedArtwork>(`${MOTIFS}/parse`, { svg: text });
      if (ticket === latest.current) setParsed(art);
    } catch (err) {
      if (ticket === latest.current) setProblem(apiMessage(err, "That file could not be read as artwork."));
    } finally {
      if (ticket === latest.current) setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    latest.current += 1;
    setSvg("");
    setParsed(null);
    setProblem("");
    setBusy(false);
  }, []);

  return { svg, parsed, problem, busy, take, reset };
}

/** The file picker plus the preview of what was read out of it. */
function SvgField({
  upload,
  label,
}: {
  upload: ReturnType<typeof useSvgUpload>;
  label: string;
}) {
  const [name, setName] = useState("");

  return (
    <div className={styles.upload}>
      <div className={styles.uploadRow}>
        <label className={styles.fileBtn}>
          <Upload size={14} aria-hidden="true" /> {name || label}
          <input
            type="file"
            accept=".svg,image/svg+xml"
            className={styles.fileInput}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setName(file.name);
              await upload.take(await file.text());
              // Cleared so picking the same file again re-reads it — a designer
              // fixing the export in place would otherwise see nothing happen.
              e.target.value = "";
            }}
          />
        </label>
        {(upload.parsed || upload.problem) && (
          <button
            type="button"
            className={styles.iconBtn}
            title="Clear"
            onClick={() => {
              setName("");
              upload.reset();
            }}
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </div>

      {upload.busy && (
        <p className={ui.muted}>
          <Loader2 size={13} className={styles.spin} aria-hidden="true" /> Reading the artwork…
        </p>
      )}

      {upload.problem && (
        <p className={ui.error}>
          <AlertTriangle size={14} aria-hidden="true" /> {upload.problem}
        </p>
      )}

      {upload.parsed && (
        <div className={styles.parsed}>
          <span className={styles.parsedArt}>
            <DesignArt viewBox={upload.parsed.viewBox} shapes={upload.parsed.shapes} size={72} />
          </span>
          <div className={styles.parsedMeta}>
            <strong>{upload.parsed.shapes.length} shape(s)</strong>
            <span>
              {upload.parsed.colorCount} colour{upload.parsed.colorCount === 1 ? "" : "s"} · drawn in {upload.parsed.viewBox}
            </span>
            <div className={styles.swatches}>
              {[...new Set(upload.parsed.shapes.map((s) => s.fill))].map((hex) => (
                <span key={hex} className={styles.swatch} style={{ background: hex }} title={hex} />
              ))}
            </div>
            <span className={styles.parsedNote}>This is what will be stitched — check nothing is missing from it.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function AddDesign({
  tabOptions,
  saving,
  onCancel,
  onCreate,
}: {
  tabOptions: { value: string; label: string; description?: string }[];
  saving: boolean;
  onCancel: () => void;
  onCreate: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const upload = useSvgUpload();
  const [name, setName] = useState<LocalizedTextMap>({});
  const [categoryId, setCategoryId] = useState(UNFILED);
  /** The surcharge, held in euros because that is what the admin types. */
  const [extra, setExtra] = useState("0");
  /** Its own colours, or one spool the customer picks. Follows the artwork until touched. */
  const [ownColours, setOwnColours] = useState<boolean | null>(null);

  const multi = (upload.parsed?.colorCount ?? 1) > 1;
  const effectiveOwn = ownColours ?? multi;
  const valid = !!upload.parsed && Object.values(toLocalizedMap(name)).some(Boolean);

  return (
    <div className={styles.addCard}>
      <SvgField upload={upload} label="Choose an SVG file" />

      <div className={styles.addFields}>
        <LocalizedTextField
          label="Name"
          hint="What the customer reads under the shape. Write English, then Generate the rest."
          value={name}
          onCommit={setName}
          translateEndpoint={TRANSLATE_TEXT}
          maxLength={80}
        />

        <div className={styles.fieldRow}>
          <label className={ui.field}>
            <span className={ui.label}>Tab</span>
            <Select value={categoryId} onChange={setCategoryId} options={tabOptions} ariaLabel="Tab" />
          </label>
          <label className={ui.field}>
            <span className={ui.label}>Extra charge (€)</span>
            <input className={ui.input} type="number" min={0} step={0.5} value={extra} onChange={(e) => setExtra(e.target.value)} />
            <span className={ui.hint}>
              Added to the embroidery price on top of the position's own price, per box. Leave it at 0 for a design that
              costs no more than the plain ones.
            </span>
          </label>
        </div>

        <Switch
          label="Stitched in its own colours"
          hint={
            effectiveOwn
              ? "The customer does not pick a thread — the design is sewn in the colours above."
              : "The customer picks one thread and the whole shape is sewn in it."
          }
          checked={effectiveOwn}
          onChange={setOwnColours}
          disabled={!upload.parsed}
        />
      </div>

      <div className={styles.addActions}>
        <button type="button" className={styles.ghostBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving || !valid}
          onClick={() => onCreate({ name, svg: upload.svg, ownColours: effectiveOwn, priceCents: toCents(extra), categoryId: categoryId === UNFILED ? null : categoryId })}
        >
          {saving ? <Loader2 size={14} className={styles.spin} aria-hidden="true" /> : <Shapes size={14} aria-hidden="true" />}
          Add design
        </button>
      </div>
    </div>
  );
}

/**
 * Editing one design. The artwork is optional here: renaming a shape or moving
 * it to another tab must not need the original file to hand, so `svg` is only
 * sent when a new one was actually chosen.
 */
function EditDesign({
  design,
  tabOptions,
  saving,
  onCancel,
  onSave,
}: {
  design: Design;
  tabOptions: { value: string; label: string; description?: string }[];
  saving: boolean;
  onCancel: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const upload = useSvgUpload();
  const [name, setName] = useState<LocalizedTextMap>(toLocalizedMap(design.name));
  const [categoryId, setCategoryId] = useState(design.categoryId ?? UNFILED);
  const [extra, setExtra] = useState(euros(design.priceCents));
  /** Null until the admin touches it, so replacement artwork can bring its own answer. */
  const [ownColours, setOwnColours] = useState<boolean | null>(null);

  const hasNewArt = !!upload.parsed;
  // A three-colour file dropped onto a design that used to be one spool almost
  // certainly wants its colours; keeping the old setting would silently flatten
  // it, and the admin would find out on the machine.
  const effectiveOwn = ownColours ?? (hasNewArt ? upload.parsed!.colorCount > 1 : design.ownColours);
  const valid = Object.values(toLocalizedMap(name)).some(Boolean);

  return (
    <div className={styles.editCard}>
      <div className={styles.editHead}>
        <span className={styles.editArt}>
          {/* Drawn as it will be sewn, so the toggle above shows its effect. */}
          <DesignArt
            viewBox={upload.parsed?.viewBox ?? design.viewBox}
            shapes={effectiveOwn ? (upload.parsed?.shapes ?? design.paths) : null}
            flatShapes={effectiveOwn ? null : (upload.parsed?.shapes ?? design.paths)}
            path={design.path}
            size={56}
          />
        </span>
        <div className={styles.editHeadMeta}>
          <strong>{design.key}</strong>
          <span className={ui.hint}>The key never changes — every stored design refers to it.</span>
        </div>
      </div>

      <LocalizedTextField label="Name" value={name} onCommit={setName} translateEndpoint={TRANSLATE_TEXT} maxLength={80} />

      <div className={styles.fieldRow}>
        <label className={ui.field}>
          <span className={ui.label}>Tab</span>
          <Select value={categoryId} onChange={setCategoryId} options={tabOptions} ariaLabel="Tab" />
        </label>
        <label className={ui.field}>
          <span className={ui.label}>Extra charge (€)</span>
          <input className={ui.input} type="number" min={0} step={0.5} value={extra} onChange={(e) => setExtra(e.target.value)} />
          <span className={ui.hint}>On top of the position's price, per box.</span>
        </label>
      </div>

      <Switch
        label="Stitched in its own colours"
        hint={
          effectiveOwn
            ? "Sewn in the colours the artwork carries; the customer picks no thread."
            : "The customer picks one thread and the whole shape is sewn in it."
        }
        checked={effectiveOwn}
        onChange={setOwnColours}
      />

      <SvgField upload={upload} label="Replace the artwork" />

      <div className={styles.addActions}>
        <button type="button" className={styles.ghostBtn} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primaryBtn}
          disabled={saving || !valid || upload.busy}
          onClick={() =>
            onSave({
              name,
              categoryId: categoryId === UNFILED ? null : categoryId,
              priceCents: toCents(extra),
              ownColours: effectiveOwn,
              ...(hasNewArt ? { svg: upload.svg } : {}),
            })
          }
        >
          {saving ? <Loader2 size={13} className={styles.spin} aria-hidden="true" /> : <Check size={13} aria-hidden="true" />}
          Save
        </button>
      </div>
    </div>
  );
}
