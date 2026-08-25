"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Check, Folder, FolderOpen, ImagePlus, Play } from "lucide-react";
import { api } from "@/lib/api";
import Modal from "./Modal";
import styles from "./MediaPicker.module.css";

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
  usageCount: number;
  url: string;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  assetCount: number;
  thumbnailUrl: string | null;
}

interface PickedAsset {
  storageKey: string;
  url: string;
  mediaType: "image" | "video" | "other";
}

interface MediaPickerProps {
  /** Currently selected GCS storage key, or null when nothing is picked. */
  value: string | null;
  /** Resolved URL for `value`, when already known (e.g. from a loaded product). */
  previewUrl?: string | null;
  /** `mediaType` is the picked asset's actual kind — callers restricted to one type (mediaType prop set) can ignore it. Unused in `multi` mode. */
  onChange?: (storageKey: string | null, url: string | null, mediaType?: "image" | "video" | "other") => void;
  label?: string;
  /** Restricts uploads and the library grid to one asset kind. Default: "image". */
  mediaType?: "image" | "video";
  /** Multi-select mode — for adding several items at once (e.g. a media gallery). Requires `onSelectMulti`. */
  multi?: boolean;
  onSelectMulti?: (assets: PickedAsset[]) => void;
  /** Renders the trigger as a dashed square "add" tile (image + plus icon) instead of the default thumbnail-and-label trigger — for dropping into a media grid alongside existing item cards. */
  asAddTile?: boolean;
  /** Extra class appended to the `asAddTile` trigger — lets a caller reshape it (e.g. a 9:16 "reel" tile for a video grid) without forking the component. */
  className?: string;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDuration(seconds: number): string {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function buildBreadcrumb(folders: FolderItem[], folderId: string | null): FolderItem[] {
  if (!folderId) return [];
  const f = folders.find((x) => x.id === folderId);
  if (!f) return [];
  return [...buildBreadcrumb(folders, f.parentId), f];
}

const LIMIT = 40;

export default function MediaPicker({ value, previewUrl, onChange, label = "Image", mediaType, multi = false, onSelectMulti, asAddTile = false, className }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "image" | "video">(mediaType ?? "");
  const [offset, setOffset] = useState(0);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [pickedAssets, setPickedAssets] = useState<MediaAsset[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(LIMIT), offset: String(offset) });
    if (search) params.set("search", search);
    if (typeFilter) params.set("mediaType", typeFilter);
    params.set("folderId", currentFolderId ?? "");
    api
      .get<{ items: MediaAsset[]; total: number }>(`/next-api/admin/media?${params}`)
      .then((d) => {
        setAssets(d.items ?? []);
        setTotal(d.total ?? 0);
      })
      .finally(() => setLoading(false));
  }, [search, typeFilter, offset, currentFolderId]);

  const loadFolders = useCallback(async () => {
    const data = await api.get<FolderItem[]>("/next-api/admin/media/folders").catch(() => []);
    setFolders(Array.isArray(data) ? data : []);
  }, []);

  // Reset browsing state on open, then fetch — in one tick so the initial
  // load reads the reset values instead of whatever the picker last had.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setOffset(0);
      setSearch("");
      setCurrentFolderId(null);
      setTypeFilter(mediaType ?? "");
      setPickedAssets([]);
      loadFolders();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [open, load]);

  function navigateTo(folderId: string | null) {
    setCurrentFolderId(folderId);
    setOffset(0);
  }

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        if (currentFolderId) form.append("folderId", currentFolderId);
        const res = await fetch("/next-api/admin/media/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error("Upload failed");
      }
      load();
      loadFolders();
    } catch {
      alert("Upload failed. Check the file type and size (images up to 20MB, videos up to 200MB).");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  }

  function select(asset: MediaAsset) {
    onChange?.(asset.storageKey, asset.url, asset.mediaType);
    setOpen(false);
  }

  function togglePicked(asset: MediaAsset) {
    setPickedAssets((prev) => (prev.some((a) => a.id === asset.id) ? prev.filter((a) => a.id !== asset.id) : [...prev, asset]));
  }

  function handleAssetClick(asset: MediaAsset) {
    if (multi) togglePicked(asset);
    else select(asset);
  }

  function confirmMulti() {
    if (!pickedAssets.length) return;
    onSelectMulti?.(pickedAssets.map((a) => ({ storageKey: a.storageKey, url: a.url, mediaType: a.mediaType })));
    setOpen(false);
  }

  const breadcrumb = buildBreadcrumb(folders, currentFolderId);
  const gridFolders = currentFolderId === null ? folders.filter((f) => f.parentId === null) : folders.filter((f) => f.parentId === currentFolderId);

  return (
    <>
      {asAddTile ? (
        <button type="button" className={`${styles.addTile} ${className ?? ""}`} onClick={() => setOpen(true)}>
          <ImagePlus size={22} strokeWidth={1.5} />
          <span>{label}</span>
        </button>
      ) : (
        <div className={styles.trigger} onClick={() => setOpen(true)}>
          {previewUrl || value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl ?? value ?? undefined} alt="" className={styles.thumb} />
          ) : (
            <div className={styles.placeholder}>No image</div>
          )}
          <span className={styles.triggerLabel}>{value ? "Change" : `Choose ${label.toLowerCase()}`}</span>
        </div>
      )}

      {open && (
        <Modal
          title={multi ? `Select ${label.toLowerCase()}${pickedAssets.length ? ` — ${pickedAssets.length} selected` : ""}` : `Select ${label.toLowerCase()}`}
          onClose={() => setOpen(false)}
          maxWidth={960}
          footer={
            multi ? (
              <div className={styles.multiFooter}>
                {pickedAssets.length > 0 && (
                  <button type="button" className={styles.removeLink} onClick={() => setPickedAssets([])}>
                    Clear selection
                  </button>
                )}
                <span style={{ flex: 1 }} />
                <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.confirmBtn} disabled={!pickedAssets.length} onClick={confirmMulti}>
                  {pickedAssets.length > 0 ? `Add ${pickedAssets.length} item${pickedAssets.length > 1 ? "s" : ""}` : "Select media"}
                </button>
              </div>
            ) : value ? (
              <button
                type="button"
                className={styles.removeLink}
                onClick={() => {
                  onChange?.(null, null);
                  setOpen(false);
                }}
              >
                Remove current image
              </button>
            ) : undefined
          }
        >
          <div
            className={`${styles.uploadZone} ${dragOver ? styles.uploadZoneActive : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={styles.uploadZoneTitle}>
              {uploading ? "Uploading…" : `Drop ${mediaType === "video" ? "videos" : mediaType === "image" ? "images" : "media"} here or click to upload`}
              {currentFolderId && !uploading && (
                <span className={styles.uploadZoneFolder}> · into {folders.find((f) => f.id === currentFolderId)?.name}</span>
              )}
            </div>
            <div className={styles.uploadZoneSub}>
              {mediaType === "video" ? "MP4, WebM — max 200 MB" : mediaType === "image" ? "JPEG, PNG, WebP, AVIF, GIF, SVG — max 20 MB" : "Images ≤20MB, videos ≤200MB"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.uploadZoneInput}
              accept={mediaType === "video" ? "video/mp4,video/webm" : mediaType === "image" ? "image/*" : "image/*,video/mp4,video/webm"}
              multiple
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
          </div>

          <div className={styles.toolbar}>
            <div className={styles.breadcrumb}>
              <button type="button" className={styles.breadcrumbBtn} onClick={() => navigateTo(null)}>
                <FolderOpen size={12} />
                All media
              </button>
              {breadcrumb.map((f, i) => (
                <span key={f.id} className={styles.breadcrumbSep}>
                  <ChevronRight size={12} />
                  {i < breadcrumb.length - 1 ? (
                    <button type="button" className={styles.breadcrumbBtn} onClick={() => navigateTo(f.id)}>
                      {f.name}
                    </button>
                  ) : (
                    <span className={styles.breadcrumbCurrent}>{f.name}</span>
                  )}
                </span>
              ))}
            </div>

            {!mediaType && (
              <div className={styles.typeFilter}>
                {(["", "image", "video"] as const).map((t) => (
                  <button
                    key={t || "all"}
                    type="button"
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
            )}

            <input
              className={styles.search}
              placeholder="Search by filename…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
            />
            <span className={styles.assetCount}>{total} assets</span>
          </div>

          <div className={styles.grid}>
            {gridFolders.map((folder) => (
              <div key={folder.id} className={styles.folderCard} onClick={() => navigateTo(folder.id)} title={folder.name}>
                <div className={styles.folderCardIcon}>
                  {folder.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={folder.thumbnailUrl} alt="" className={styles.folderCardThumb} loading="lazy" draggable={false} />
                  ) : (
                    <Folder size={28} strokeWidth={1.5} />
                  )}
                </div>
                <div className={styles.folderCardName}>{folder.name}</div>
                <div className={styles.folderCardCount}>
                  {folder.assetCount} item{folder.assetCount !== 1 ? "s" : ""}
                </div>
              </div>
            ))}

            {loading
              ? Array.from({ length: 10 }, (_, i) => <div key={i} className={`${styles.gridItem} ${styles.skeleton}`} />)
              : assets.length === 0 && gridFolders.length === 0
                ? (
                    <div className={styles.empty}>
                      <div className={styles.emptyTitle}>No media{currentFolderId ? " in this folder" : " yet"}</div>
                      <div className={styles.emptyHint}>Drop a file above to upload one.</div>
                    </div>
                  )
                : assets.map((a) => {
                    const isPicked = multi ? pickedAssets.some((p) => p.id === a.id) : a.storageKey === value;
                    return (
                    <div key={a.id} className={isPicked ? styles.gridItemSelected : styles.gridItem} onClick={() => handleAssetClick(a)} title={a.originalFilename}>
                      {a.mediaType === "video" ? (
                        <div className={styles.videoThumb}>
                          <video src={a.url} className={styles.gridImg} muted preload="metadata" />
                          <div className={styles.playIconOverlay}>
                            <Play size={16} fill="#fff" color="#fff" />
                          </div>
                          {a.durationSeconds != null && <div className={styles.durationBadge}>{fmtDuration(a.durationSeconds)}</div>}
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.altText ?? a.originalFilename} className={styles.gridImg} loading="lazy" />
                      )}
                      {multi && !isPicked && <div className={styles.pickerCheckbox} />}
                      {isPicked && (
                        <div className={styles.gridItemCheck}>
                          <Check size={14} strokeWidth={2.5} />
                        </div>
                      )}
                      {a.usageCount > 0 && <div className={styles.gridItemUsage}>{a.usageCount} uses</div>}
                      <div className={styles.gridItemMeta}>
                        <div className={styles.gridItemName}>{a.originalFilename}</div>
                        <div className={styles.gridItemSize}>
                          {fmtSize(a.sizeBytes)}
                          {a.width ? ` · ${a.width}×${a.height}` : ""}
                        </div>
                      </div>
                    </div>
                    );
                  })}
          </div>

          {!loading && total > LIMIT && (
            <div className={styles.pagination}>
              <button type="button" disabled={offset === 0} onClick={() => setOffset((o) => Math.max(0, o - LIMIT))} className={styles.pageBtn}>
                Previous
              </button>
              <span className={styles.pageIndicator}>
                {Math.floor(offset / LIMIT) + 1} / {Math.ceil(total / LIMIT)}
              </span>
              <button type="button" disabled={offset + LIMIT >= total} onClick={() => setOffset((o) => o + LIMIT)} className={styles.pageBtn}>
                Next
              </button>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
