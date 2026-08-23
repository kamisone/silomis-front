"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import Button from "@/components/admin/ui/Button";
import Modal from "@/components/admin/ui/Modal";
import AudienceSelector, { type AudienceDefinition } from "@/components/admin/marketing/AudienceSelector";
import ui from "@/components/admin/ui/admin-ui.module.css";

const RichTextEditor = dynamic(() => import("@/components/admin/content/RichTextEditor"), { ssr: false });

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

interface Campaign {
  id: string;
  title: string;
  subject: string;
  previewText: string | null;
  htmlContent: string;
  audience: AudienceDefinition;
  status: CampaignStatus;
  type: string;
  tags: string[];
  scheduledAt: string | null;
  sentAt: string | null;
}

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

function badgeClass(status: CampaignStatus): string {
  if (status === "sent") return ui.badgeActive;
  if (status === "cancelled") return ui.badgeInactive;
  return ui.badge;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "newsletter", label: "Newsletter" },
  { value: "promotion", label: "Promotion" },
  { value: "new_arrivals", label: "New Arrivals" },
  { value: "flash_sale", label: "Flash Sale" },
  { value: "category", label: "Category" },
  { value: "abandoned_cart", label: "Abandoned Cart" },
  { value: "product_launch", label: "Product Launch" },
  { value: "announcement", label: "Announcement" },
];

function errMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? String((err.body as { message?: string })?.message ?? fallback) : fallback;
}

export default function CampaignEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ text: string; isError: boolean } | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [type, setType] = useState("newsletter");
  const [tagsInput, setTagsInput] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [audience, setAudience] = useState<AudienceDefinition>({ segment: "all" });

  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Campaign>(`/next-api/admin/newsletter/campaigns/${id}`);
      setCampaign(data);
      setTitle(data.title);
      setSubject(data.subject);
      setPreviewText(data.previewText ?? "");
      setType(data.type);
      setTagsInput(data.tags?.join(", ") ?? "");
      setHtmlContent(data.htmlContent ?? "");
      setAudience(data.audience ?? { segment: "all" });
    } catch (err) {
      setNotice({ text: errMessage(err, "Failed to load campaign"), isError: true });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const editable = campaign?.status === "draft" || campaign?.status === "scheduled";

  async function save() {
    if (!campaign) return;
    setSaving(true);
    try {
      await api.patch(`/next-api/admin/newsletter/campaigns/${campaign.id}`, {
        title: title.trim(),
        subject: subject.trim(),
        previewText: previewText.trim() || undefined,
        htmlContent,
        audience,
        type,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setNotice({ text: "Campaign saved", isError: false });
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Save failed"), isError: true });
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    if (!campaign || !testEmail.trim()) {
      setNotice({ text: "Enter an email address", isError: true });
      return;
    }
    try {
      await api.post(`/next-api/admin/newsletter/campaigns/${campaign.id}/send-test`, { to: testEmail.trim() });
      setNotice({ text: "Test email sent", isError: false });
      setTestOpen(false);
      setTestEmail("");
    } catch (err) {
      setNotice({ text: errMessage(err, "Failed to send test email"), isError: true });
    }
  }

  async function schedule() {
    if (!campaign || !scheduleAt) {
      setNotice({ text: "Pick a date and time", isError: true });
      return;
    }
    try {
      await api.post(`/next-api/admin/newsletter/campaigns/${campaign.id}/schedule`, { scheduledAt: new Date(scheduleAt).toISOString() });
      setNotice({ text: "Campaign scheduled", isError: false });
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Schedule failed"), isError: true });
    }
  }

  async function sendNow() {
    if (!campaign) return;
    if (!confirm("Send this campaign now to its audience? This cannot be undone.")) return;
    try {
      await api.post(`/next-api/admin/newsletter/campaigns/${campaign.id}/send-now`);
      setNotice({ text: "Campaign queued for sending", isError: false });
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Send failed"), isError: true });
    }
  }

  async function cancel() {
    if (!campaign) return;
    if (!confirm("Cancel this scheduled campaign?")) return;
    try {
      await api.post(`/next-api/admin/newsletter/campaigns/${campaign.id}/cancel`);
      setNotice({ text: "Campaign cancelled", isError: false });
      await load();
    } catch (err) {
      setNotice({ text: errMessage(err, "Cancel failed"), isError: true });
    }
  }

  async function duplicate() {
    if (!campaign) return;
    try {
      const data = await api.post<{ id: string }>(`/next-api/admin/newsletter/campaigns/${campaign.id}/duplicate`);
      router.push(`/admin/marketing/campaigns/${data.id}`);
    } catch (err) {
      setNotice({ text: errMessage(err, "Duplicate failed"), isError: true });
    }
  }

  async function remove() {
    if (!campaign) return;
    if (!confirm("Delete this draft campaign?")) return;
    try {
      await api.delete(`/next-api/admin/newsletter/campaigns/${campaign.id}`);
      router.push("/admin/marketing/campaigns");
    } catch (err) {
      setNotice({ text: errMessage(err, "Delete failed"), isError: true });
    }
  }

  if (loading || !campaign) {
    return (
      <div className={ui.page}>
        <div className={ui.emptyState}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>
          {campaign.title} <span className={badgeClass(campaign.status)}>{STATUS_LABELS[campaign.status]}</span>
        </h1>
        <div className={ui.rowActions}>
          {editable && (
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          )}
          <Button variant="secondary" onClick={() => setTestOpen(true)}>
            Send test
          </Button>
          {campaign.status === "draft" && <Button onClick={sendNow}>Send now</Button>}
          {campaign.status === "scheduled" && (
            <Button variant="danger" onClick={cancel}>
              Cancel
            </Button>
          )}
          {(campaign.status === "sent" || campaign.status === "cancelled") && (
            <Button variant="secondary" onClick={duplicate}>
              Duplicate
            </Button>
          )}
          {campaign.status === "draft" && (
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {notice && (
        <p className={notice.isError ? ui.error : undefined} style={{ marginTop: "-0.5rem", marginBottom: "1rem", fontSize: "0.85rem", color: notice.isError ? undefined : "var(--color-primary)" }}>
          {notice.text}
        </p>
      )}
      {campaign.scheduledAt && (
        <p style={{ color: "var(--color-secondary)", fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Scheduled for {new Date(campaign.scheduledAt).toLocaleString()}
        </p>
      )}
      {campaign.sentAt && (
        <p style={{ color: "var(--color-secondary)", fontSize: "0.8rem", marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Sent on {new Date(campaign.sentAt).toLocaleString()}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className={ui.card}>
            <div className={ui.formGrid}>
              <div className={ui.field}>
                <label className={ui.label}>Internal title</label>
                <input className={ui.input} value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} />
              </div>
              <div className={ui.field}>
                <label className={ui.label}>Email subject</label>
                <input className={ui.input} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!editable} />
              </div>
              <div className={ui.field} style={{ gridColumn: "span 2" }}>
                <label className={ui.label}>Preview text</label>
                <input className={ui.input} value={previewText} onChange={(e) => setPreviewText(e.target.value)} disabled={!editable} placeholder="Shown after the subject line in most inboxes" />
              </div>
            </div>
          </div>

          <div className={ui.card} style={{ padding: 0, overflow: "hidden" }}>
            <RichTextEditor content={htmlContent} onChange={editable ? setHtmlContent : () => {}} />
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className={ui.card}>
            <div className={ui.field} style={{ marginBottom: "0.85rem" }}>
              <label className={ui.label}>Campaign type</label>
              <select className={ui.select} value={type} onChange={(e) => setType(e.target.value)} disabled={!editable} style={{ width: "100%" }}>
                {TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={ui.field}>
              <label className={ui.label}>Tags (comma-separated)</label>
              <input className={ui.input} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} disabled={!editable} />
            </div>
          </div>

          <div className={ui.card}>
            <label className={ui.label} style={{ display: "block", marginBottom: "0.6rem" }}>
              Audience
            </label>
            {editable ? (
              <AudienceSelector value={audience} onChange={setAudience} />
            ) : (
              <p style={{ fontSize: "0.8rem", color: "var(--color-secondary)" }}>
                {audience.segment}
                {audience.tags?.length ? `: ${audience.tags.join(", ")}` : ""}
              </p>
            )}
          </div>

          {campaign.status === "draft" && (
            <div className={ui.card}>
              <label className={ui.label} style={{ display: "block", marginBottom: "0.6rem" }}>
                Schedule
              </label>
              <input className={ui.input} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} style={{ marginBottom: "0.6rem" }} />
              <Button onClick={schedule} style={{ width: "100%" }}>
                Schedule
              </Button>
            </div>
          )}
        </div>
      </div>

      {testOpen && (
        <Modal
          title="Send test email"
          onClose={() => setTestOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setTestOpen(false)}>
                Cancel
              </Button>
              <Button onClick={sendTest}>Send</Button>
            </>
          }
        >
          <div className={ui.field}>
            <label className={ui.label}>Recipient email</label>
            <input className={ui.input} type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} autoFocus />
          </div>
        </Modal>
      )}
    </div>
  );
}
