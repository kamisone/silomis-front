"use client";

import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { useToast, type ToastType } from "./ToastContext";
import styles from "./Toaster.module.css";

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} strokeWidth={1.75} />,
  error: <XCircle size={16} strokeWidth={1.75} />,
  warning: <AlertTriangle size={16} strokeWidth={1.75} />,
  info: <Info size={16} strokeWidth={1.75} />,
};

export default function Toaster() {
  const { toasts, dismiss } = useToast();
  if (!toasts.length) return null;

  return (
    <div className={styles.container} role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`} role="alert">
          <span className={styles.icon}>{ICONS[t.type]}</span>
          <span className={styles.message}>{t.message}</span>
          <button className={styles.close} onClick={() => dismiss(t.id)} aria-label="Dismiss">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      ))}
    </div>
  );
}
