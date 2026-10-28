"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { slugify } from "@/lib/slugify";
import { useToast } from "@/components/toast/ToastContext";
import styles from "./Brands.module.css";

interface StoreBrandRow {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  isActive: boolean;
  productCount: number;
}

/**
 * Brands a product can be sold under instead of Silomis — a mini coffee maker
 * presented as if the shop sold nothing else. Created here, filled in on the
 * brand's own page, then linked to its products.
 */
export default function StoreBrandsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [brands, setBrands] = useState<StoreBrandRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<StoreBrandRow[]>("/next-api/admin/shop/store-brands")
      .then(setBrands)
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const created = await api.post<StoreBrandRow>("/next-api/admin/shop/store-brands", { name, slug: slug || slugify(name) });
      router.push(`/admin/shop/brands/${created.id}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Could not create the brand") : "Could not create the brand");
      setSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Neutral brands</h1>
        <Button
          onClick={() => {
            setName("");
            setSlug("");
            setSlugEdited(false);
            setCreating(true);
          }}
        >
          New brand
        </Button>
      </div>
      <p className={styles.lead}>
        Sell a product under its own name instead of Silomis. Its pages, cart, checkout, emails, texts and the bank statement show the brand&apos;s logo and
        name, and its footer links to the brand&apos;s own About, FAQ and Contact pages. The legal pages stay the company&apos;s, with the brand&apos;s name.
      </p>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : brands.length === 0 ? (
          <div className={ui.emptyState}>No brands yet. Every product is sold as Silomis.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Brand</th>
                <th>Slug</th>
                <th>Products</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/admin/shop/brands/${b.id}`} className={styles.nameCell}>
                      {b.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logoUrl} alt="" className={styles.logoThumb} />
                      ) : (
                        <span className={styles.logoThumb} aria-hidden="true" />
                      )}
                      {b.name}
                    </Link>
                  </td>
                  <td>{b.slug}</td>
                  <td>{b.productCount}</td>
                  <td>
                    <span className={b.isActive ? ui.badgeActive : ui.badgeInactive}>{b.isActive ? "active" : "off"}</span>
                  </td>
                  <td>
                    <div className={ui.rowActions}>
                      <Link href={`/admin/shop/brands/${b.id}`}>
                        <Button variant="secondary">Edit</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {creating && (
        <Modal
          title="New brand"
          onClose={() => setCreating(false)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" form="new-brand-form" disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </>
          }
        >
          <form id="new-brand-form" onSubmit={handleSubmit} className={styles.createForm}>
            <div className={ui.field}>
              <label className={ui.label}>Brand name</label>
              <input
                className={ui.input}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugEdited) setSlug(slugify(e.target.value));
                }}
                placeholder="BrewMini"
                required
                autoFocus
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Slug</label>
              <input
                className={ui.input}
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                required
              />
              <span className={styles.hint}>In the address of the brand&apos;s pages: /brand/{slug || "…"}/about</span>
            </div>
            <p className={styles.hint}>You&apos;ll add the logo, footer, pages and products next.</p>
          </form>
        </Modal>
      )}
    </div>
  );
}
