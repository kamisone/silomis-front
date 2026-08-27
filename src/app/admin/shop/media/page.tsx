"use client";

import { Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X, Folder, FolderOpen, Pencil, Trash2, Check, ChevronRight, Plus, Play } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useEntityTranslations } from "@/hooks/useEntityTranslations";
import { useCopyGenerate } from "@/hooks/useCopyGenerate";
import BilingualField from "@/components/admin/BilingualField";
import styles from "./Media.module.css";

// ── Types ─────────────────────────────────────────────────────────────────

interface MediaFolder {
  id: string;
  name: string;
  parentId: string | null;
  assetCount: number;
  thumbnailUrl: string | null;
  createdAt: string;
}

interface MediaAsset {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  mediaType: "image" | "video" | "other";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  altText: string | null;
  title: string | null;
  tags: string[];
  folderId: string | null;
  usageCount: number;
  url: string;
  createdAt: string;
}

interface UsageRecord {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function buildBreadcrumb(folders: MediaFolder[], folderId: string | null): MediaFolder[] {
  if (!folderId) return [];
  const f = folders.find((x) => x.id === folderId);
  if (!f) return [];
  return [...buildBreadcrumb(folders, f.parentId), f];
}

function getFolderPath(folders: MediaFolder[], folderId: string): string {
  const f = folders.find((x) => x.id === folderId);
  if (!f) return "";
  if (!f.parentId) return f.name;
  const parentPath = getFolderPath(folders, f.parentId);
  return parentPath ? `${parentPath} / ${f.name}` : f.name;
}

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

const LIMIT = 48;

// ── Main component ───────────────────────────────────────────────────────

export default function MediaLibraryPage() {
  // useSearchParams needs a Suspense boundary during prerender
  return (
    <Suspense fallback={null}>
      <MediaLibrary />
    </Suspense>
  );
}

function MediaLibrary() {
  // Navigation — the current folder lives in the URL (?folder=<id>) so a
  // refresh, a shared link, or the back button lands on the same folder.
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get("folder"); // null = All Media

  // Folders
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState("");

  // Assets
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [mimeFilter, setMimeFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "image" | "video">("");
  const [offset, setOffset] = useState(0);

  // Detail panel
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [usage, setUsage] = useState<UsageRecord[]>([]);
  const [altText, setAltText] = useState("");
  const [title, setTitle] = useState("");
  const [movingToFolder, setMovingToFolder] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const { translations, setTranslation, saveTranslations } = useEntityTranslations("media_asset", selected?.id ?? null);
  const gen = useCopyGenerate(setTranslation);

  // Upload
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const renamingRef = useRef<HTMLInputElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null); // "" = root, uuid = folder id
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Data loading ─────────────────────────────────────────────────────

  const loadFolders = useCallback(async () => {
    try {
      const data = await api.get<MediaFolder[]>("/next-api/admin/media/folders");
      setFolders(Array.isArray(data) ? data : []);
    } catch {
      setFolders([]);
    }
  }, []);

  const loadAssets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (search) params.set("search", search);
    if (mimeFilter) params.set("mimeType", mimeFilter);
    if (typeFilter) params.set("mediaType", typeFilter);
    params.set("folderId", currentFolderId ?? ""); // "" → backend filters folder_id IS NULL
    api
      .get<{ items: MediaAsset[]; total: number }>(`/next-api/admin/media?${params}`)
      .then((d) => {
        setAssets(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {
        setAssets([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [search, mimeFilter, typeFilter, offset, currentFolderId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);
  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // ── Navigation ───────────────────────────────────────────────────────

  function navigateTo(folderId: string | null) {
    router.push(folderId ? `${pathname}?folder=${folderId}` : pathname, { scroll: false });
    setOffset(0);
    setSelected(null);
  }

  const breadcrumb = buildBreadcrumb(folders, currentFolderId);
  // Subfolders shown as cards at the top of the main grid
  const gridFolders = currentFolderId === null ? folders.filter((f) => f.parentId === null) : folders.filter((f) => f.parentId === currentFolderId);

  // ── Folder CRUD ──────────────────────────────────────────────────────

  async function submitNewFolder(e?: React.FormEvent) {
    e?.preventDefault();
    const name = newFolderName.trim();
    if (!name) {
      setIsCreatingFolder(false);
      return;
    }
    try {
      await api.post("/next-api/admin/media/folders", { name, parentId: currentFolderId });
    } catch (err) {
      alert(errMessage(err, "Could not create folder"));
    }
    setNewFolderName("");
    setIsCreatingFolder(false);
    await loadFolders();
  }

  function startCreatingFolder() {
    setIsCreatingFolder(true);
    setRenamingId(null);
    setTimeout(() => newFolderRef.current?.focus(), 50);
  }

  function startRenaming(folder: MediaFolder, e: React.MouseEvent) {
    e.stopPropagation();
    setRenamingId(folder.id);
    setRenamingName(folder.name);
    setTimeout(() => renamingRef.current?.focus(), 50);
  }

  async function submitRename(e?: React.FormEvent) {
    e?.preventDefault();
    if (!renamingId || !renamingName.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await api.patch(`/next-api/admin/media/folders/${renamingId}`, { name: renamingName.trim() });
    } catch (err) {
      alert(errMessage(err, "Could not rename folder"));
    }
    setRenamingId(null);
    await loadFolders();
  }

  async function deleteFolder(folder: MediaFolder, e: React.MouseEvent) {
    e.stopPropagation();
    const msg = folder.assetCount > 0 ? `Delete "${folder.name}"? Its ${folder.assetCount} asset(s) will be moved to the parent folder.` : `Delete folder "${folder.name}"?`;
    if (!confirm(msg)) return;
    try {
      await api.delete(`/next-api/admin/media/folders/${folder.id}`);
    } catch (err) {
      alert(errMessage(err, "Could not delete folder"));
      return;
    }
    if (currentFolderId === folder.id) navigateTo(folder.parentId);
    await loadFolders();
  }

  // ── Asset actions ────────────────────────────────────────────────────

  async function openDetail(asset: MediaAsset) {
    setSelected(asset);
    setAltText(asset.altText ?? "");
    setTitle(asset.title ?? "");
    setMovingToFolder(asset.folderId ?? "");
    try {
      const data = await api.get<UsageRecord[]>(`/next-api/admin/media/${asset.id}/usage`);
      setUsage(Array.isArray(data) ? data : []);
    } catch {
      setUsage([]);
    }
  }

  async function saveSeoFields() {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.patch<MediaAsset>(`/next-api/admin/media/${selected.id}`, { altText, title });
      await saveTranslations(selected.id, ["altText", "title"]);
      setSelected({ ...selected, ...updated });
      setAssets((prev) => prev.map((a) => (a.id === selected.id ? { ...a, altText, title } : a)));
    } catch (err) {
      alert(errMessage(err, "Could not save"));
    } finally {
      setSaving(false);
    }
  }

  async function moveToFolder(targetFolderId: string) {
    if (!selected) return;
    const folderId = targetFolderId === "" ? null : targetFolderId;
    setSaving(true);
    try {
      await api.patch(`/next-api/admin/media/${selected.id}`, { folderId });
    } catch (err) {
      alert(errMessage(err, "Could not move asset"));
      setSaving(false);
      return;
    }
    setMovingToFolder(targetFolderId);
    setSelected((prev) => (prev ? { ...prev, folderId } : null));
    setAssets((prev) => prev.map((a) => (a.id === selected.id ? { ...a, folderId } : a)));
    setSaving(false);
    await loadFolders();
    // Remove asset from current folder view if it was moved out
    if (currentFolderId !== null && folderId !== currentFolderId) {
      setAssets((prev) => prev.filter((a) => a.id !== selected.id));
      setTotal((t) => t - 1);
      setSelected(null);
    }
  }

  async function deleteAsset() {
    if (!selected || !confirm(`Delete "${selected.originalFilename}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/next-api/admin/media/${selected.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        alert(errMessage(err, "This asset is still in use and cannot be deleted."));
        return;
      }
      alert(errMessage(err, "Could not delete asset"));
      return;
    }
    setSelected(null);
    loadAssets();
    loadFolders();
  }

  // ── Upload ───────────────────────────────────────────────────────────

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    const all = Array.from(files);
    for (let i = 0; i < all.length; i++) {
      setUploadPct(Math.round((i / all.length) * 100));
      const form = new FormData();
      form.append("file", all[i]);
      if (currentFolderId) form.append("folderId", currentFolderId);
      try {
        await fetch("/next-api/admin/media/upload", { method: "POST", body: form });
      } catch {
        // best-effort — continue with the remaining files
      }
    }
    setUploadPct(100);
    setUploading(false);
    setUploadPct(0);
    setOffset(0);
    loadAssets();
    loadFolders();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  function copyKey() {
    if (selected) navigator.clipboard.writeText(selected.storageKey);
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────

  function onNewFolderKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsCreatingFolder(false);
      setNewFolderName("");
    }
  }

  function onRenamingKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") setRenamingId(null);
  }

  // ── Drag-and-drop assets onto folders ───────────────────────────────

  function onAssetDragStart(e: React.DragEvent, assetId: string) {
    // If this card is part of a multi-selection, drag all selected IDs
    const ids = selectedIds.has(assetId) && selectedIds.size > 1 ? Array.from(selectedIds) : [assetId];
    setDraggingId(assetId);
    e.dataTransfer.setData("text/plain", ids.join(","));
    e.dataTransfer.effectAllowed = "move";
  }

  function onAssetDragEnd() {
    setDraggingId(null);
    setDragTarget(null);
  }

  function onTargetOver(e: React.DragEvent, targetId: string) {
    // Use dataTransfer.types to detect asset drags (more reliable than a ref)
    if (!e.dataTransfer.types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragTarget(targetId);
  }

  function onTargetLeave(e: React.DragEvent) {
    if (e.relatedTarget && (e.currentTarget as Element).contains(e.relatedTarget as Node)) return;
    setDragTarget(null);
  }

  async function onDropToFolder(e: React.DragEvent, targetFolderId: string | null) {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/plain");
    setDraggingId(null);
    setDragTarget(null);
    if (!raw) return;

    const assetIds = raw.split(",").filter((id) => {
      const a = assets.find((x) => x.id === id);
      return a && a.folderId !== targetFolderId;
    });
    if (!assetIds.length) return;

    // Optimistic: remove from current view immediately
    setAssets((prev) => prev.filter((a) => !assetIds.includes(a.id)));
    setTotal((t) => t - assetIds.length);
    if (selected && assetIds.includes(selected.id)) setSelected(null);
    setSelectedIds(new Set());

    try {
      if (assetIds.length === 1) {
        await api.patch(`/next-api/admin/media/${assetIds[0]}`, { folderId: targetFolderId });
      } else {
        await api.post("/next-api/admin/media/bulk-move", { assetIds, folderId: targetFolderId });
      }
    } catch {
      // best-effort — refresh either way below
    }
    loadFolders();
  }

  // ── Sidebar folder tree renderer ────────────────────────────────────

  function renderFolderTree(parentId: string | null, depth = 0): React.ReactNode {
    const children = folders.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
    if (!children.length) return null;

    return children.map((folder) => (
      // sidebarTreeGroup flattens (display: contents) on small screens so the
      // nested tree becomes a flat horizontal chip strip
      <div key={folder.id} className={styles.sidebarTreeGroup}>
        <div
          className={`${styles.sidebarItem} ${currentFolderId === folder.id ? styles.sidebarItemActive : ""} ${dragTarget === folder.id ? styles.sidebarItemDragOver : ""}`}
          style={{ paddingLeft: 12 + depth * 14 }}
          onClick={() => navigateTo(folder.id)}
          title={folder.name}
          onDragOver={(e) => onTargetOver(e, folder.id)}
          onDragLeave={onTargetLeave}
          onDrop={(e) => onDropToFolder(e, folder.id)}
        >
          {currentFolderId === folder.id ? <FolderOpen size={13} className={styles.sidebarFolderIcon} /> : <Folder size={13} className={styles.sidebarFolderIcon} />}
          {renamingId === folder.id ? (
            <form onSubmit={submitRename} className={styles.sidebarRenameForm} onClick={(e) => e.stopPropagation()}>
              <input
                ref={renamingRef}
                className={styles.sidebarRenameInput}
                value={renamingName}
                onChange={(e) => setRenamingName(e.target.value)}
                onKeyDown={onRenamingKeyDown}
                onBlur={() => submitRename()}
              />
              <button type="submit" className={styles.sidebarRenameConfirm} aria-label="Save">
                <Check size={11} />
              </button>
            </form>
          ) : (
            <span className={styles.sidebarItemName}>{folder.name}</span>
          )}
          {renamingId !== folder.id && (
            <>
              {folder.assetCount > 0 && <span className={styles.sidebarCount}>{folder.assetCount}</span>}
              <span className={styles.sidebarActions}>
                <button className={styles.sidebarAction} onClick={(e) => startRenaming(folder, e)} aria-label="Rename" title="Rename">
                  <Pencil size={11} />
                </button>
                <button className={`${styles.sidebarAction} ${styles.sidebarActionDelete}`} onClick={(e) => deleteFolder(folder, e)} aria-label="Delete" title="Delete folder">
                  <Trash2 size={11} />
                </button>
              </span>
            </>
          )}
        </div>
        {renderFolderTree(folder.id, depth + 1)}
      </div>
    ));
  }

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <h1 className={styles.title}>Media Library</h1>
          <span className={styles.subtitle}>
            {total} asset{total !== 1 ? "s" : ""}
          </span>
        </div>
        <button className={styles.uploadBtn} onClick={() => fileInputRef.current?.click()}>
          ↑ Upload Media
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/webm"
          multiple
          style={{ display: "none" }}
          onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        />
      </div>

      {/* ── Body: sidebar + main ── */}
      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          <button
            className={`${styles.sidebarAllMedia} ${currentFolderId === null ? styles.sidebarItemActive : ""} ${dragTarget === "" ? styles.sidebarItemDragOver : ""}`}
            onClick={() => navigateTo(null)}
            onDragOver={(e) => onTargetOver(e, "")}
            onDragLeave={onTargetLeave}
            onDrop={(e) => onDropToFolder(e, null)}
          >
            <FolderOpen size={13} className={styles.sidebarFolderIcon} />
            <span className={styles.sidebarItemName}>All Media</span>
          </button>

          <div className={styles.sidebarSection}>
            <span className={styles.sidebarSectionLabel}>Folders</span>
            {!isCreatingFolder && (
              <button className={styles.newFolderInlineBtn} onClick={startCreatingFolder} title="New folder">
                <Plus size={12} />
              </button>
            )}
          </div>

          {isCreatingFolder && (
            <form onSubmit={submitNewFolder} className={styles.newFolderForm}>
              <Folder size={13} className={styles.sidebarFolderIcon} />
              <input
                ref={newFolderRef}
                className={styles.newFolderInput}
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={onNewFolderKeyDown}
                placeholder="Folder name"
                onBlur={() => {
                  if (!newFolderName.trim()) setIsCreatingFolder(false);
                }}
              />
              <button type="submit" className={styles.sidebarRenameConfirm} aria-label="Create">
                <Check size={11} />
              </button>
            </form>
          )}

          <div className={styles.sidebarTree}>{renderFolderTree(null)}</div>
        </aside>

        {/* ── Main area ── */}
        <main className={styles.main}>
          {/* ── Breadcrumb ── */}
          <div className={styles.breadcrumb}>
            <button className={styles.breadcrumbItem} onClick={() => navigateTo(null)}>
              All Media
            </button>
            {breadcrumb.map((f, i) => (
              <span key={f.id} className={styles.breadcrumbRow}>
                <ChevronRight size={12} className={styles.breadcrumbSep} />
                {i < breadcrumb.length - 1 ? (
                  <button className={styles.breadcrumbItem} onClick={() => navigateTo(f.id)}>
                    {f.name}
                  </button>
                ) : (
                  <span className={styles.breadcrumbCurrent}>{f.name}</span>
                )}
              </span>
            ))}
          </div>

          {/* ── Upload zone ── */}
          <div
            className={`${styles.uploadZone} ${dragOver ? styles.uploadZoneActive : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer.types.includes("Files")) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={styles.uploadZoneTitle}>
              {uploading ? `Uploading… ${uploadPct}%` : "Drag & drop media here to upload"}
              {currentFolderId && !uploading && (
                <span className={styles.uploadZoneFolder}>
                  {" · "}into <strong>{folders.find((f) => f.id === currentFolderId)?.name}</strong>
                </span>
              )}
            </div>
            <div className={styles.uploadZoneSub}>JPEG, PNG, WebP, AVIF, GIF, SVG, MP4, WebM — images ≤20MB, videos ≤200MB · deduplication enabled</div>
          </div>

          {uploading && (
            <div className={styles.uploadProgress}>
              <div className={styles.uploadProgressBar} style={{ width: `${uploadPct}%` }} />
            </div>
          )}

          {/* ── Toolbar ── */}
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className={styles.searchInput}
                placeholder="Search by filename…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
            </div>
            <div className={styles.typeFilter}>
              {(["", "image", "video"] as const).map((t) => (
                <button
                  key={t || "all"}
                  className={`${styles.typeFilterBtn} ${typeFilter === t ? styles.typeFilterBtnActive : ""}`}
                  onClick={() => {
                    setTypeFilter(t);
                    setOffset(0);
                  }}
                >
                  {t === "" ? "All" : t === "image" ? "Images" : "Videos"}
                </button>
              ))}
            </div>
            <select
              className={styles.filterSelect}
              value={mimeFilter}
              onChange={(e) => {
                setMimeFilter(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All formats</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/png">PNG</option>
              <option value="image/webp">WebP</option>
              <option value="image/avif">AVIF</option>
              <option value="image/gif">GIF</option>
              <option value="image/svg+xml">SVG</option>
              <option value="video/mp4">MP4</option>
              <option value="video/webm">WebM</option>
            </select>
            <div className={styles.toolbarRight}>
              {total} asset{total !== 1 ? "s" : ""}
            </div>
          </div>

          {/* ── Grid: folder cards + asset cards ── */}
          <div className={styles.grid}>
            {/* Folder cards */}
            {gridFolders.map((folder) => (
              <div
                key={folder.id}
                className={`${styles.folderCard} ${dragTarget === folder.id ? styles.folderCardDragOver : ""}`}
                onClick={() => navigateTo(folder.id)}
                title={folder.name}
                onDragOver={(e) => onTargetOver(e, folder.id)}
                onDragLeave={onTargetLeave}
                onDrop={(e) => onDropToFolder(e, folder.id)}
              >
                <div className={styles.folderCardIcon}>
                  {/* Cover image so the grid is scannable without opening each
                      folder; the icon remains the fallback for empty ones. */}
                  {folder.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={folder.thumbnailUrl} alt="" className={styles.folderCardThumb} loading="lazy" draggable={false} />
                  ) : (
                    <Folder size={32} strokeWidth={1.5} />
                  )}
                </div>
                <div className={styles.folderCardMeta}>
                  <div className={styles.folderCardName}>{folder.name}</div>
                  <div className={styles.folderCardCount}>
                    {folder.assetCount} item{folder.assetCount !== 1 ? "s" : ""}
                  </div>
                </div>
              </div>
            ))}

            {/* Asset cards */}
            {loading ? (
              Array.from({ length: 24 }, (_, i) => <div key={i} className={styles.skeleton} />)
            ) : assets.length === 0 && gridFolders.length === 0 ? (
              <div className={styles.empty}>
                <span className={styles.emptyIcon}>🖼</span>
                <span className={styles.emptyText}>No assets{currentFolderId ? " in this folder" : ""}</span>
                <span className={styles.emptyHint}>{currentFolderId ? "Upload images or move assets here" : "Upload your first image using the button above"}</span>
              </div>
            ) : (
              assets.map((a) => (
                <div
                  key={a.id}
                  draggable
                  onDragStart={(e) => onAssetDragStart(e, a.id)}
                  onDragEnd={onAssetDragEnd}
                  className={`${styles.gridItem} ${selected?.id === a.id ? styles.gridItemSelected : ""} ${selectedIds.has(a.id) ? styles.gridItemChecked : ""} ${draggingId === a.id ? styles.gridItemDragging : ""}`}
                  onClick={() => {
                    if (selected?.id === a.id) setSelected(null);
                    else openDetail(a);
                  }}
                >
                  {/* Checkbox for multi-select */}
                  <button
                    className={`${styles.cardCheckbox} ${selectedIds.has(a.id) ? styles.cardCheckboxChecked : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(a.id)) next.delete(a.id);
                        else next.add(a.id);
                        return next;
                      });
                    }}
                    aria-label={selectedIds.has(a.id) ? "Deselect" : "Select"}
                  >
                    {selectedIds.has(a.id) && <Check size={10} strokeWidth={3} />}
                  </button>
                  {/* Count badge when dragging multiple */}
                  {draggingId === a.id && selectedIds.has(a.id) && selectedIds.size > 1 && <div className={styles.dragCountBadge}>{selectedIds.size}</div>}
                  {a.mediaType === "video" ? (
                    <div className={styles.videoThumb}>
                      <video src={a.url} className={styles.gridItemImg} muted preload="metadata" />
                      <div className={styles.playIconOverlay}>
                        <span>
                          <Play size={16} fill="#fff" />
                        </span>
                      </div>
                      {a.durationSeconds != null && <div className={styles.durationBadge}>{formatDuration(a.durationSeconds)}</div>}
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.url} alt={a.altText ?? a.originalFilename} className={styles.gridItemImg} loading="lazy" />
                  )}
                  {a.usageCount > 0 && <div className={styles.gridItemUsage}>{a.usageCount}</div>}
                  <div className={styles.gridItemMeta}>
                    <div className={styles.gridItemName}>{a.originalFilename}</div>
                    <div className={styles.gridItemSize}>
                      {fmtSize(a.sizeBytes)}
                      {a.mediaType === "video" && a.durationSeconds != null ? ` · ${formatDuration(a.durationSeconds)}` : ""}
                      {a.width ? ` · ${a.width}×${a.height}` : ""}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ── Pagination ── */}
          {!loading && total > LIMIT && (
            <div className={styles.pagination}>
              <button className={styles.pageBtn} disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}>
                ← Previous
              </button>
              <span className={styles.pageInfo}>
                {Math.floor(offset / LIMIT) + 1} / {Math.ceil(total / LIMIT)}
              </span>
              <button className={styles.pageBtn} disabled={offset + LIMIT >= total} onClick={() => setOffset((o) => o + LIMIT)}>
                Next →
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Detail panel ── */}
      {selected && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHead}>
            <span className={styles.detailHeadTitle}>Asset Details</span>
            <button className={styles.detailClose} onClick={() => setSelected(null)}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>

          <div className={styles.detailBody}>
            {selected.mediaType === "video" ? (
              <video src={selected.url} className={styles.detailVideo} controls preload="metadata" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.url} alt={selected.altText ?? ""} className={styles.detailImg} />
            )}

            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>Filename</div>
              <div className={styles.detailValue}>{selected.originalFilename}</div>
            </div>
            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>Type</div>
              <div className={styles.detailValue}>{selected.mimeType}</div>
            </div>
            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>Size</div>
              <div className={styles.detailValue}>{fmtSize(selected.sizeBytes)}</div>
            </div>
            {selected.mediaType === "video" && selected.durationSeconds != null && (
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Duration</div>
                <div className={styles.detailValue}>{formatDuration(selected.durationSeconds)}</div>
              </div>
            )}
            {selected.width && (
              <div className={styles.detailRow}>
                <div className={styles.detailLabel}>Dimensions</div>
                <div className={styles.detailValue}>
                  {selected.width} × {selected.height} px
                </div>
              </div>
            )}
            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>Uploaded</div>
              <div className={styles.detailValue}>{new Date(selected.createdAt).toLocaleDateString("en-GB")}</div>
            </div>
            <div className={styles.detailRow}>
              <div className={styles.detailLabel}>Storage key</div>
              <div className={`${styles.detailValue} ${styles.detailValueMono}`}>
                {selected.storageKey}
                <button className={styles.copyBtn} onClick={copyKey}>
                  Copy
                </button>
              </div>
            </div>

            {/* Move to folder */}
            <div className={styles.detailRow} style={{ marginTop: 16 }}>
              <div className={styles.detailLabel}>Folder</div>
              <select className={styles.folderSelect} value={movingToFolder} onChange={(e) => moveToFolder(e.target.value)} disabled={saving}>
                <option value="">No folder (All Media)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {getFolderPath(folders, f.id)}
                  </option>
                ))}
              </select>
            </div>

            {/* SEO fields */}
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div className={styles.detailLabel} style={{ fontWeight: 700, fontSize: 12, marginBottom: -4 }}>
                SEO &amp; Accessibility
              </div>

              <BilingualField
                label="Alt Text"
                field="altText"
                baseValue={altText}
                baseOnChange={setAltText}
                basePlaceholder="Image description"
                translations={translations}
                onTranslationChange={setTranslation}
                overlayPlaceholder="Image description"
                multiline
                rows={2}
                {...gen.field("altText", altText)}
              />

              <BilingualField
                label="Title"
                field="title"
                baseValue={title}
                baseOnChange={setTitle}
                basePlaceholder="Image title"
                translations={translations}
                onTranslationChange={setTranslation}
                overlayPlaceholder="Image title"
                {...gen.field("title", title)}
              />

              <button className={styles.saveAltBtn} onClick={saveSeoFields} disabled={saving}>
                {saving ? "Saving…" : "Save SEO Fields"}
              </button>
            </div>

            {/* Usage */}
            {usage.length > 0 && (
              <>
                <div className={styles.usageTitle}>Used by ({usage.length})</div>
                {usage.map((u) => (
                  <div key={u.id} className={styles.usageItem}>
                    <span className={styles.usageEntity}>{u.entityType}</span>
                    {" · "}
                    {u.field}
                    <span className={styles.usageId}>{u.entityId.slice(0, 8)}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          <div className={styles.detailFoot}>
            <button className={styles.deleteBtn} onClick={deleteAsset}>
              Delete Asset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
