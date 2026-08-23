"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Category {
  id: string;
  name: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Category[]>("/next-api/admin/shop/categories").then(setCategories);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const product = await api.post<{ id: string }>("/next-api/admin/shop/products", {
        title,
        basePriceCents: Math.round(Number(price || 0) * 100),
        categoryIds: categoryId ? [categoryId] : [],
        primaryCategoryId: categoryId || undefined,
      });
      router.push(`/admin/shop/products/${product.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Could not create product") : "Could not create product");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page} style={{ maxWidth: 480 }}>
      <h1 className={ui.pageTitle}>New product</h1>
      <p style={{ color: "var(--color-secondary)", fontSize: "0.9rem" }}>Start with the basics — you can fill in everything else (media, variants, SEO) after creating it.</p>
      <div className={ui.card} style={{ padding: "1.5rem" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {error && <p className={ui.error}>{error}</p>}
          <div className={ui.field}>
            <label className={ui.label}>Title</label>
            <input className={ui.input} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>Base price (€)</label>
            <input className={ui.input} type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className={ui.field}>
            <label className={ui.label}>Category (optional)</label>
            <select className={ui.select} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create product"}
          </Button>
        </form>
      </div>
    </div>
  );
}
