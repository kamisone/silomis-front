"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import Select from "@/components/admin/ui/Select";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { ADMIN_ROLES, type AdminAccount, type AdminRole, roleBadgeClass } from "./roles";

const FORM_ID = "admin-create-form";

interface CreateForm {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}

const EMPTY_FORM: CreateForm = { name: "", email: "", password: "", role: "admin" };

export default function AdminsPage() {
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<CreateForm | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setAdmins(await api.get<AdminAccount[]>("/next-api/admins"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      await api.post("/next-api/admins", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      setForm(null);
      await load();
      toast.success("Admin created");
    } catch (err) {
      toast.error(err instanceof ApiError ? String((err.body as { message?: string })?.message ?? "Failed to create admin") : "Failed to create admin");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.pageTitle}>Admins</h1>
          <p className={ui.pageHint}>Everyone who can sign in to this dashboard. Open an admin to change their role, reset their password or set up two-factor.</p>
        </div>
        <Button onClick={() => setForm({ ...EMPTY_FORM })}>New admin</Button>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : admins.length === 0 ? (
          <div className={ui.emptyState}>No admins yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Two-factor</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.email}</td>
                  <td>
                    <span className={roleBadgeClass(a.role, ui)}>{a.role}</span>
                  </td>
                  <td>
                    {a.mfaEnabled ? (
                      <span className={ui.badge}>{a.preferredMfaMethod === "sms" ? "SMS" : "Email"}</span>
                    ) : (
                      <span className={ui.muted}>Off</span>
                    )}
                  </td>
                  <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className={ui.rowActions}>
                      <Link href={`/admin/settings/admins/${a.id}`}>
                        <Button variant="secondary">Manage</Button>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <Modal
          title="New admin"
          onClose={() => setForm(null)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} disabled={saving}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </>
          }
        >
          <form id={FORM_ID} onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Email</label>
              <input className={ui.input} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Password</label>
              {/* The only time a password is set from here without the account
                  owner present, so it is shown rather than masked — an admin
                  has to be able to read back what they are about to hand over. */}
              <input
                className={ui.input}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Role</label>
              <Select value={form.role} options={ADMIN_ROLES} onChange={(role) => setForm({ ...form, role })} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
