"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminTopBar from "./AdminTopBar";
import styles from "./AdminShell.module.css";

const MOBILE_BREAKPOINT = 720;

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMobileOpen(false), 0);
    return () => clearTimeout(t);
  }, [pathname]);

  const handleToggle = useCallback(() => {
    if (isMobile) setMobileOpen((o) => !o);
    else setCollapsed((c) => !c);
  }, [isMobile]);

  const effectiveCollapsed = isMobile ? !mobileOpen : collapsed;

  return (
    <div className={`${styles.shell} ${effectiveCollapsed ? styles.collapsed : ""}`}>
      {isMobile && mobileOpen && <div className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <AdminSidebar
        collapsed={effectiveCollapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={handleToggle}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={styles.main}>
        <AdminTopBar onMobileMenuOpen={() => setMobileOpen(true)} />
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
