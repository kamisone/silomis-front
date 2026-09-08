"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import Select from "@/components/admin/ui/Select";
import Switch from "@/components/admin/ui/Switch";
import ui from "@/components/admin/ui/admin-ui.module.css";
import { ADMIN_ROLES, type AdminAccount, type AdminRole, roleBadgeClass } from "../roles";

const MFA_METHODS = [
  { value: "email" as const, label: "Email", description: "The code is sent to this admin's email address." },
  { value: "sms" as const, label: "SMS", description: "The code is texted to the phone number below." },
];

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);
  /** The logged-in admin, so this page can refuse to delete the chair it is sitting on. */
  const [meId, setMeId] = useState<string | null>(null);

  const [profile, setProfile] = useState({ name: "", email: "", role: "admin" as AdminRole });
  const [savingProfile, setSavingProfile] = useState(false);

  const [mfa, setMfa] = useState({ mfaEnabled: false, preferredMfaMethod: "email" as "email" | "sms", phone: "" });
  const [savingMfa, setSavingMfa] = useState(false);

  const [password, setPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function hydrate(data: AdminAccount) {
    setAdmin(data);
    setProfile({ name: data.name, email: data.email, role: data.role });
    setMfa({
      mfaEnabled: data.mfaEnabled ?? false,
      preferredMfaMethod: data.preferredMfaMethod ?? "email",
      phone: data.phone ?? "",
    });
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get<AdminAccount>(`/next-api/admins/${id}`).catch(() => null),
      api.get<{ id: string }>("/next-api/auth/me").catch(() => null),
    ])
      .then(([data, me]) => {
        if (cancelled) return;
        if (data) hydrate(data);
        setMeId(me?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      hydrate(
        await api.patch<AdminAccount>(`/next-api/admins/${id}`, {
          name: profile.name.trim(),
          email: profile.email.trim(),
          role: profile.role,
        }),
      );
      toast.success("Admin updated");
    } catch (err) {
      toast.error(errMessage(err, "Failed to save"));
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSaveMfa(e: FormEvent) {
    e.preventDefault();
    // Checked here as well as on the way in: enabling SMS with no number
    // stores a setting that can only fail at the login prompt, which is the
    // worst possible moment to discover it.
    if (mfa.mfaEnabled && mfa.preferredMfaMethod === "sms" && !mfa.phone.trim()) {
      toast.error("A phone number is required for SMS verification");
      return;
    }
    setSavingMfa(true);
    try {
      hydrate(
        await api.patch<AdminAccount>(`/next-api/admins/${id}/mfa`, {
          mfaEnabled: mfa.mfaEnabled,
          preferredMfaMethod: mfa.preferredMfaMethod,
          phone: mfa.phone.trim() || null,
        }),
      );
      toast.success("Two-factor settings saved");
    } catch (err) {
      toast.error(errMessage(err, "Failed to save two-factor settings"));
    } finally {
      setSavingMfa(false);
    }
  }

  async function handleResetPassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    try {
      await api.post(`/next-api/admins/${id}/reset-password`, { password });
      setPassword("");
      toast.success("Password updated");
    } catch (err) {
      toast.error(errMessage(err, "Failed to reset password"));
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/next-api/admins/${id}`);
      toast.success("Admin deleted");
      router.replace("/admin/settings/admins");
    } catch (err) {
      toast.error(errMessage(err, "Failed to delete admin"));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className={ui.page}>
        <div className={ui.card}>
          <div className={ui.emptyState}>Loading…</div>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className={ui.page}>
        <div className={ui.card}>
          <div className={ui.emptyState}>This admin no longer exists.</div>
        </div>
        <Link href="/admin/settings/admins">
          <Button variant="secondary">Back to admins</Button>
        </Link>
      </div>
    );
  }

  const isSelf = meId !== null && meId === admin.id;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <Link href="/admin/settings/admins" className={ui.muted} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <ArrowLeft size={14} /> Admins
          </Link>
          <h1 className={ui.pageTitle}>
            {admin.name} <span className={roleBadgeClass(admin.role, ui)}>{admin.role}</span>
          </h1>
          <p className={ui.pageHint}>{admin.email}</p>
        </div>
      </div>

      {/* ── Profile ── */}
      <div className={ui.card}>
        <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className={ui.formGrid}>
            <div className={ui.field}>
              <label className={ui.label}>Name</label>
              <input className={ui.input} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Role</label>
              <Select value={profile.role} options={ADMIN_ROLES} onChange={(role) => setProfile({ ...profile, role })} />
            </div>
          </div>
          <div className={ui.field}>
            <label className={ui.label}>Email</label>
            <input className={ui.input} type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} required />
            <span className={ui.pageHint}>This is the address they sign in with.</span>
          </div>
          <div>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Two-factor ── */}
      <div className={ui.card}>
        <form onSubmit={handleSaveMfa} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Switch
            label="Two-factor authentication"
            hint="A one-time code is required after the password on every sign-in."
            checked={mfa.mfaEnabled}
            onChange={(mfaEnabled) => setMfa({ ...mfa, mfaEnabled })}
          />
          {mfa.mfaEnabled && (
            <>
              <div className={ui.field}>
                <label className={ui.label}>Where to send the code</label>
                <Select value={mfa.preferredMfaMethod} options={MFA_METHODS} onChange={(preferredMfaMethod) => setMfa({ ...mfa, preferredMfaMethod })} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Phone number {mfa.preferredMfaMethod === "sms" ? "(required)" : "(optional)"}</label>
                <input className={ui.input} type="tel" placeholder="+33 6 12 34 56 78" value={mfa.phone} onChange={(e) => setMfa({ ...mfa, phone: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <Button type="submit" disabled={savingMfa}>
              {savingMfa ? "Saving…" : "Save two-factor settings"}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Password ── */}
      <div className={ui.card}>
        <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className={ui.field}>
            <label className={ui.label}>Set a new password</label>
            <input className={ui.input} value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="At least 6 characters" />
            <span className={ui.pageHint}>Replaces the current password immediately. Any session they already have stays signed in.</span>
          </div>
          <div>
            <Button type="submit" disabled={savingPassword || password.length < 6}>
              {savingPassword ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Delete ── */}
      <div className={ui.card}>
        <div className={ui.field}>
          <label className={ui.label}>Delete this admin</label>
          <span className={ui.pageHint}>
            {isSelf
              ? "This is the account you are signed in with — sign in as another admin to delete it."
              : "They lose access immediately. Their refresh tokens are revoked with the account."}
          </span>
        </div>
        <div>
          <Button variant="danger" disabled={isSelf} onClick={() => setConfirmDelete(true)}>
            Delete admin
          </Button>
        </div>
      </div>

      {confirmDelete && (
        <Modal
          title="Delete admin"
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <Button type="button" variant="secondary" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </>
          }
        >
          <p>
            Delete <strong>{admin.name}</strong> ({admin.email})? They will not be able to sign in again. This cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
