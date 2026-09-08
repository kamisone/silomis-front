"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, CalendarDays, Eye, EyeOff, KeyRound, Mail, Phone, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import Select from "@/components/admin/ui/Select";
import Switch from "@/components/admin/ui/Switch";
import ui from "@/components/admin/ui/admin-ui.module.css";
import styles from "./admin-detail.module.css";
import { ADMIN_ROLES, type AdminAccount, type AdminRole, roleBadgeClass } from "../roles";

const MFA_METHODS = [
  { value: "email" as const, label: "Email", description: "The code is sent to this admin's email address." },
  { value: "sms" as const, label: "SMS", description: "The code is texted to the phone number on their profile." },
];

const MIN_PASSWORD_LENGTH = 6;

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

/** Up to two letters, so the avatar reads as a person rather than a blob. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(true);
  /** The logged-in admin, so this page can refuse to delete the chair it is sitting on. */
  const [meId, setMeId] = useState<string | null>(null);

  const [profile, setProfile] = useState({ name: "", email: "", phone: "", role: "admin" as AdminRole });
  const [savingProfile, setSavingProfile] = useState(false);

  const [mfa, setMfa] = useState({ mfaEnabled: false, preferredMfaMethod: "email" as "email" | "sms" });
  const [savingMfa, setSavingMfa] = useState(false);

  const [password, setPassword] = useState("");
  const [revealPassword, setRevealPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function hydrate(data: AdminAccount) {
    setAdmin(data);
    setProfile({ name: data.name, email: data.email, phone: data.phone ?? "", role: data.role });
    setMfa({
      mfaEnabled: data.mfaEnabled ?? false,
      preferredMfaMethod: data.preferredMfaMethod ?? "email",
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
          phone: profile.phone.trim() || null,
          role: profile.role,
        }),
      );
      toast.success("Profile saved");
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
    if (mfa.mfaEnabled && mfa.preferredMfaMethod === "sms" && !admin?.phone) {
      toast.error("Add a phone number under Profile and save it first");
      return;
    }
    setSavingMfa(true);
    try {
      hydrate(
        await api.patch<AdminAccount>(`/next-api/admins/${id}/mfa`, {
          mfaEnabled: mfa.mfaEnabled,
          preferredMfaMethod: mfa.preferredMfaMethod,
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
      setRevealPassword(false);
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
        <div className={`${styles.skeleton} ${styles.skeletonHero}`} />
        <div className={styles.layout}>
          <div className={styles.column}>
            <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
            <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
          </div>
          <div className={styles.column}>
            <div className={`${styles.skeleton} ${styles.skeletonCard}`} />
          </div>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className={ui.page}>
        <Link href="/admin/settings/admins" className={styles.back}>
          <ArrowLeft size={14} /> Admins
        </Link>
        <div className={ui.card}>
          <div className={ui.emptyState}>This admin no longer exists.</div>
        </div>
      </div>
    );
  }

  const isSelf = meId !== null && meId === admin.id;
  const smsWithoutPhone = mfa.mfaEnabled && mfa.preferredMfaMethod === "sms" && !admin.phone;

  return (
    <div className={ui.page}>
      <Link href="/admin/settings/admins" className={styles.back}>
        <ArrowLeft size={14} /> Admins
      </Link>

      {/* ── Identity header ── */}
      <div className={styles.hero}>
        <div className={styles.avatar} aria-hidden="true">
          {initials(admin.name)}
        </div>
        <div className={styles.heroText}>
          <h1 className={styles.heroName}>
            {admin.name}
            <span className={roleBadgeClass(admin.role, ui)}>{admin.role}</span>
            {isSelf && <span className={styles.selfChip}>You</span>}
          </h1>
          <div className={styles.heroMeta}>
            <span className={styles.heroMetaItem}>
              <Mail size={13} /> {admin.email}
            </span>
            <span className={styles.heroMetaItem}>
              <Phone size={13} />
              {admin.phone ?? <span className={styles.heroMetaMissing}>no phone on file</span>}
            </span>
            <span className={styles.heroMetaItem}>
              <CalendarDays size={13} /> Joined {formatDate(admin.createdAt)}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.column}>
          {/* ── Profile ── */}
          <form className={styles.card} onSubmit={handleSaveProfile}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <UserRound size={16} />
              </span>
              <div className={styles.cardHeading}>
                <h2 className={styles.cardTitle}>Profile</h2>
                <span className={styles.cardDesc}>Who they are and how the shop reaches them.</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.grid2}>
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
                <span className={styles.hint}>The address they sign in with.</span>
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Phone number</label>
                <input
                  className={ui.input}
                  type="tel"
                  placeholder="+33 6 12 34 56 78"
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                />
                <span className={styles.hint}>
                  Where admin SMS alerts reach them — new orders, low stock and support messages — and where an
                  SMS two-factor code is sent. Leave blank and they get email only.
                </span>
              </div>
            </div>
            <div className={styles.cardFooter}>
              <Button type="submit" disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </div>
          </form>

          {/* ── Two-factor ── */}
          <form className={styles.card} onSubmit={handleSaveMfa}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <ShieldCheck size={16} />
              </span>
              <div className={styles.cardHeading}>
                <h2 className={styles.cardTitle}>Two-factor authentication</h2>
                <span className={styles.cardDesc}>A second step after the password on every sign-in.</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <Switch
                label="Require a one-time code"
                hint="Asked for after the password, every time they sign in."
                checked={mfa.mfaEnabled}
                onChange={(mfaEnabled) => setMfa({ ...mfa, mfaEnabled })}
              />
              {mfa.mfaEnabled && (
                <div className={ui.field}>
                  <label className={ui.label}>Where to send the code</label>
                  <Select
                    value={mfa.preferredMfaMethod}
                    options={MFA_METHODS}
                    onChange={(preferredMfaMethod) => setMfa({ ...mfa, preferredMfaMethod })}
                  />
                  {mfa.preferredMfaMethod === "sms" &&
                    (admin.phone ? (
                      <span className={styles.hint}>Codes are texted to {admin.phone} — change it under Profile.</span>
                    ) : (
                      <span className={styles.warn}>
                        <AlertTriangle size={13} className={styles.warnIcon} />
                        No phone number on file. Add one under Profile and save it, or this admin will be locked
                        out at the code prompt.
                      </span>
                    ))}
                </div>
              )}
            </div>
            <div className={styles.cardFooter}>
              <Button type="submit" disabled={savingMfa || smsWithoutPhone}>
                {savingMfa ? "Saving…" : "Save two-factor"}
              </Button>
            </div>
          </form>

          {/* ── Password ── */}
          <form className={styles.card} onSubmit={handleResetPassword}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <KeyRound size={16} />
              </span>
              <div className={styles.cardHeading}>
                <h2 className={styles.cardTitle}>Password</h2>
                <span className={styles.cardDesc}>Set a new one on their behalf.</span>
              </div>
            </div>
            <div className={styles.cardBody}>
              <div className={ui.field}>
                <label className={ui.label}>New password</label>
                <div className={styles.passwordWrap}>
                  <input
                    className={ui.input}
                    type={revealPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={MIN_PASSWORD_LENGTH}
                    autoComplete="new-password"
                    placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                  />
                  <button
                    type="button"
                    className={styles.revealBtn}
                    onClick={() => setRevealPassword((v) => !v)}
                    aria-label={revealPassword ? "Hide password" : "Show password"}
                  >
                    {revealPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <span className={styles.hint}>
                  Replaces the current password immediately. Any session they already have stays signed in.
                </span>
              </div>
            </div>
            <div className={styles.cardFooter}>
              {password.length > 0 && password.length < MIN_PASSWORD_LENGTH && (
                <span className={styles.footerNote}>
                  {MIN_PASSWORD_LENGTH - password.length} more character
                  {MIN_PASSWORD_LENGTH - password.length === 1 ? "" : "s"} needed
                </span>
              )}
              <Button type="submit" disabled={savingPassword || password.length < MIN_PASSWORD_LENGTH}>
                {savingPassword ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        </div>

        {/* ── Rail ── */}
        <div className={styles.column}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardHeading}>
                <h2 className={styles.cardTitle}>Account</h2>
              </div>
            </div>
            <div className={styles.summaryList}>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Role</span>
                <span className={roleBadgeClass(admin.role, ui)}>{admin.role}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Two-factor</span>
                <span className={`${styles.pill} ${admin.mfaEnabled ? styles.pillOn : styles.pillOff}`}>
                  {admin.mfaEnabled ? `On · ${admin.preferredMfaMethod}` : "Off"}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>SMS alerts</span>
                <span className={`${styles.pill} ${admin.phone ? styles.pillOn : styles.pillOff}`}>
                  {admin.phone ? "Reachable" : "No phone"}
                </span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Created</span>
                <span className={styles.summaryValue}>{formatDate(admin.createdAt)}</span>
              </div>
              <div className={styles.summaryRow}>
                <span className={styles.summaryLabel}>Last updated</span>
                <span className={styles.summaryValue}>{formatDate(admin.updatedAt)}</span>
              </div>
            </div>
          </div>

          {/* ── Danger zone ── */}
          <div className={`${styles.card} ${styles.dangerCard}`}>
            <div className={styles.cardHeader}>
              <span className={styles.cardIcon}>
                <Trash2 size={16} />
              </span>
              <div className={styles.cardHeading}>
                <h2 className={styles.cardTitle}>Delete admin</h2>
              </div>
            </div>
            <div className={styles.cardBody}>
              <span className={styles.hint}>
                {isSelf
                  ? "This is the account you are signed in with. Sign in as another admin to delete it."
                  : "They lose access immediately, and their refresh tokens are revoked with the account."}
              </span>
              <div>
                <Button variant="danger" disabled={isSelf} onClick={() => setConfirmDelete(true)}>
                  Delete admin
                </Button>
              </div>
            </div>
          </div>
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
            Delete <strong>{admin.name}</strong> ({admin.email})? They will not be able to sign in again. This
            cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
