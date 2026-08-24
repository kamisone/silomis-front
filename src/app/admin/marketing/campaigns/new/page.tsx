"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useToast } from "@/components/toast/ToastContext";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function NewCampaignPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!title.trim() || !subject.trim()) {
      setError("Title and subject are required");
      toast.error("Title and subject are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const data = await api.post<{ id: string }>("/next-api/admin/newsletter/campaigns", { title: title.trim(), subject: subject.trim() });
      router.push(`/admin/marketing/campaigns/${data.id}`);
    } catch (err) {
      const msg = errMessage(err, "Failed to create campaign");
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={ui.page} style={{ maxWidth: 560 }}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>New Campaign</h1>
      </div>

      <div className={ui.card}>
        {error && (
          <p className={ui.error} style={{ marginBottom: "1rem" }}>
            {error}
          </p>
        )}
        <div className={ui.field} style={{ marginBottom: "1rem" }}>
          <label className={ui.label}>Title (internal name)</label>
          <input className={ui.input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer Sale 2026" autoFocus />
        </div>
        <div className={ui.field} style={{ marginBottom: "1rem" }}>
          <label className={ui.label}>Email subject</label>
          <input className={ui.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. ☀️ Summer Sale — up to 30% off" />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <Button variant="secondary" onClick={() => router.push("/admin/marketing/campaigns")}>
            Cancel
          </Button>
          <Button onClick={create} disabled={saving}>
            {saving ? "Creating…" : "Create & continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
