"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Button from "./Button";
import Modal from "./Modal";
import styles from "./MediaPicker.module.css";

interface MediaAsset {
  id: string;
  storageKey: string;
  url: string;
  mimeType: string;
  originalFilename: string;
}

interface MediaPickerProps {
  /** Currently selected GCS storage key, or null when nothing is picked. */
  value: string | null;
  /** Resolved URL for `value`, when already known (e.g. from a loaded product). */
  previewUrl?: string | null;
  onChange: (storageKey: string | null, url: string | null) => void;
  label?: string;
  /** Restricts uploads and the library grid to one asset kind. Default: "image". */
  mediaType?: "image" | "video";
}

export default function MediaPicker({ value, previewUrl, onChange, label = "Image", mediaType = "image" }: MediaPickerProps) {
  const [open, setOpen] = useState(false);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAssets() {
    setLoading(true);
    try {
      const data = await api.get<{ items: MediaAsset[] }>(`/next-api/admin/media?mediaType=${mediaType}&limit=60`);
      setAssets(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) loadAssets();
  }, [open]);

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/next-api/admin/media/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const asset: MediaAsset = await res.json();
      onChange(asset.storageKey, asset.url);
      setOpen(false);
    } catch {
      alert("Upload failed. Check the file type and size (images up to 20MB).");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <div className={styles.trigger} onClick={() => setOpen(true)}>
        {previewUrl || value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl ?? value ?? undefined} alt="" className={styles.thumb} />
        ) : (
          <div className={styles.placeholder}>No image</div>
        )}
        <span className={styles.triggerLabel}>{value ? "Change" : `Choose ${label.toLowerCase()}`}</span>
      </div>

      {open && (
        <Modal title={`Select ${label.toLowerCase()}`} onClose={() => setOpen(false)}>
          <div className={styles.uploadRow}>
            <input
              ref={fileInputRef}
              type="file"
              accept={mediaType === "video" ? "video/*" : "image/*"}
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload new image"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="danger"
                onClick={() => {
                  onChange(null, null);
                  setOpen(false);
                }}
              >
                Remove image
              </Button>
            )}
          </div>

          {loading ? (
            <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>Loading library…</p>
          ) : assets.length === 0 ? (
            <p style={{ color: "var(--color-secondary)", fontSize: "0.85rem" }}>No images uploaded yet.</p>
          ) : (
            <div className={styles.grid}>
              {assets.map((a) => (
                <div
                  key={a.id}
                  className={a.storageKey === value ? styles.gridItemSelected : styles.gridItem}
                  onClick={() => {
                    onChange(a.storageKey, a.url);
                    setOpen(false);
                  }}
                  title={a.originalFilename}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.originalFilename} className={styles.gridImg} />
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
