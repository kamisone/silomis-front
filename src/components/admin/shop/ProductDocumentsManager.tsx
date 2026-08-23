"use client";

import { useRef, useState } from "react";
import { FileText, GripVertical, Plus, Trash2, Upload } from "lucide-react";
import BilingualField from "@/components/admin/BilingualField";
import type { OverlayLang } from "@/hooks/useEntityTranslations";
import type { ProductDocument } from "@/lib/shop/productContent.types";
import styles from "./ProductDocumentsManager.module.css";

const MAX_DOC_BYTES = 20 * 1024 * 1024;

function genId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Props {
  productId: string;
  initialDocuments: ProductDocument[];
  translations: Record<OverlayLang, Record<string, string>>;
  onTranslationChange: (lang: OverlayLang, field: string, value: string) => void;
  onChange: (items: ProductDocument[]) => void;
}

export default function ProductDocumentsManager({
  productId,
  initialDocuments,
  translations,
  onTranslationChange,
  onChange,
}: Props) {
  const [items, setItems] = useState<ProductDocument[]>(initialDocuments);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function notify(next: ProductDocument[]) {
    const reordered = next.map((d, i) => ({ ...d, sortOrder: i }));
    setItems(reordered);
    onChange(reordered);
  }

  function update(index: number, patch: Partial<ProductDocument>) {
    notify(items.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function remove(index: number) {
    notify(items.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); return; }
    const next = [...items];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    notify(next);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setUploadError("Only PDF files are accepted.");
      return;
    }
    if (file.size > MAX_DOC_BYTES) {
      setUploadError("File too large (max 20 MB).");
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/next-api/admin/shop/products/${productId}/documents/upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();

      const doc: ProductDocument = {
        id: genId(),
        title: "",
        storageKey: data.storageKey,
        originalFilename: data.originalFilename,
        sizeBytes: data.sizeBytes,
        sortOrder: items.length,
      };
      notify([...items, doc]);
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept=".pdf,application/pdf" onChange={handleFileChange} hidden />

      {items.length === 0 && (
        <p className={styles.empty}>No documents yet. Upload PDF files (notice, spec sheet, etc.).</p>
      )}

      <div className={styles.list}>
        {items.map((doc, i) => (
          <div
            key={doc.id}
            className={`${styles.card} ${dragIndex === i ? styles.cardDragging : ""}`}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => setDragIndex(null)}
          >
            <div className={styles.cardHead}>
              <span className={styles.dragHandle}><GripVertical size={16} /></span>
              <FileText size={16} className={styles.fileIcon} />
              <span className={styles.cardMeta}>
                {doc.originalFilename} · {fmtSize(doc.sizeBytes)}
              </span>
              <button type="button" className={styles.removeBtn} onClick={() => remove(i)} title="Remove">
                <Trash2 size={15} />
              </button>
            </div>
            <div className={styles.cardBody}>
              <BilingualField
                label="Document title"
                field={`document:${doc.id}:title`}
                baseValue={doc.title}
                baseOnChange={val => update(i, { title: val })}
                basePlaceholder="e.g. User manual, Spec sheet"
                baseRequired
                translations={translations}
                onTranslationChange={onTranslationChange}
                overlayPlaceholder="e.g. Manuel d'utilisation, Fiche technique"
              />
            </div>
          </div>
        ))}
      </div>

      {uploadError && <p className={styles.error}>{uploadError}</p>}

      <button
        type="button"
        className={styles.addBtn}
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <><Upload size={16} /> Uploading...</>
        ) : (
          <><Plus size={16} /> <span>Upload PDF</span></>
        )}
      </button>

      <p className={styles.hint}>Upload PDF documents that customers can download from the product page. Drag to reorder.</p>
    </div>
  );
}
