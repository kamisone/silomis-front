"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import peStyles from "@/app/admin/shop/products/ProductEdit.module.css";
import styles from "./CollapsibleSection.module.css";

interface Props {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  /** Closed by default — the admin expands it to edit. */
  defaultOpen?: boolean;
  last?: boolean;
}

export default function CollapsibleSection({ icon, title, children, defaultOpen = false, last = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  function toggle() {
    setOpen(o => !o);
  }

  return (
    <div className={`${peStyles.section} ${last ? peStyles.sectionLast : ""}`}>
      <div
        className={`${peStyles.sectionHead} ${styles.headRow}`}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
          }
        }}
      >
        <span className={peStyles.sectionIcon}>{icon}</span>
        <span className={peStyles.sectionTitle}>{title}</span>
        <ChevronDown size={16} className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`} />
      </div>
      {open && <div className={peStyles.sectionBody}>{children}</div>}
    </div>
  );
}
