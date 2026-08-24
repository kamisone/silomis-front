"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import styles from "./contacts.module.css";

interface Contact {
  id: string;
  name: string;
  contact: string;
  subject: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api.get<Contact[]>("/next-api/admin/contacts")
      .then(setContacts)
      .finally(() => setLoading(false));
  }, []);

  const markRead = (id: string) => {
    api.patch(`/next-api/admin/contacts/${id}/read`, {}).then(() => {
      setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, read: true } : c)));
    });
  };

  const toggle = (c: Contact) => {
    setExpandedId((prev) => (prev === c.id ? null : c.id));
    if (!c.read) markRead(c.id);
  };

  const unreadCount = contacts.filter((c) => !c.read).length;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Contact Messages</h1>
          {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount} unread</span>}
        </div>
      </div>

      {loading ? (
        <div className={styles.loadingRow}>
          <span className={styles.spinner} />
        </div>
      ) : contacts.length === 0 ? (
        <p className={styles.empty}>No contact messages yet.</p>
      ) : (
        <div className={styles.list}>
          {contacts.map((c) => {
            const isOpen = expandedId === c.id;
            return (
              <div
                key={c.id}
                className={`${styles.item} ${!c.read ? styles.itemUnread : ""} ${isOpen ? styles.itemOpen : ""}`}
              >
                <button type="button" className={styles.itemHeader} onClick={() => toggle(c)}>
                  <div className={styles.itemMeta}>
                    {!c.read && <span className={styles.dot} aria-label="unread" />}
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{c.name}</span>
                      <span className={styles.itemContact}>{c.contact}</span>
                    </div>
                  </div>
                  <div className={styles.itemRight}>
                    <span className={styles.itemSubject}>{c.subject}</span>
                    <span className={styles.itemDate}>
                      {new Date(c.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className={styles.chevron}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </button>

                {isOpen && (
                  <div className={styles.itemBody}>
                    <p className={styles.messageText}>{c.message}</p>
                    <div className={styles.itemFooter}>
                      <span className={styles.itemDateFull}>{new Date(c.createdAt).toLocaleString()}</span>
                      {!c.read ? (
                        <button type="button" className={styles.readBtn} onClick={() => markRead(c.id)}>
                          Mark as read
                        </button>
                      ) : (
                        <span className={styles.readLabel}>Read</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
