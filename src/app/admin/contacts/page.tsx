"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import ui from "@/components/admin/ui/admin-ui.module.css";

interface Contact {
  id: string;
  name: string;
  contact: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(true);
  const [openId, setOpenId]     = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    api.get<Contact[]>("/next-api/admin/contacts")
      .then(setContacts)
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const open = (c: Contact) => {
    setOpenId(openId === c.id ? null : c.id);
    if (!c.read) {
      api.patch(`/next-api/admin/contacts/${c.id}/read`, {}).then(() => {
        setContacts(prev => prev.map(x => x.id === c.id ? { ...x, read: true } : x));
      });
    }
  };

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Contact Messages</h1>
      </div>

      <div className={ui.card}>
        {loading ? (
          <div className={ui.emptyState}>Loading…</div>
        ) : contacts.length === 0 ? (
          <div className={ui.emptyState}>No messages yet.</div>
        ) : (
          <table className={ui.table}>
            <thead>
              <tr>
                <th />
                <th>From</th>
                <th>Contact</th>
                <th>Subject</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <>
                  <tr key={c.id} onClick={() => open(c)} style={{ cursor: "pointer" }}>
                    <td>{!c.read && <span className={ui.badgeActive}>New</span>}</td>
                    <td style={{ fontWeight: c.read ? 400 : 700 }}>{c.name}</td>
                    <td style={{ color: "var(--color-secondary)" }}>{c.contact}</td>
                    <td style={{ fontWeight: c.read ? 400 : 700 }}>{c.subject}</td>
                    <td style={{ color: "var(--color-secondary)" }}>{new Date(c.createdAt).toLocaleString()}</td>
                  </tr>
                  {openId === c.id && (
                    <tr key={`${c.id}-detail`}>
                      <td colSpan={5} style={{ background: "var(--color-surface-tint)", whiteSpace: "pre-wrap" }}>{c.message}</td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
