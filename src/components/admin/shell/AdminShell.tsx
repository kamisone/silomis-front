"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const topBarRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);

  /* The top bar is sticky at top:0, so anything else that wants to stick has
     to clear it. Publishing its measured height as --admin-topbar-height
     keeps those offsets correct if the bar's contents ever change height,
     rather than each page guessing a px value. Written straight to the DOM
     node — no state, so no re-render and no set-state-in-effect. */
  useEffect(() => {
    const shell = shellRef.current;
    // The wrapper is display:contents so it never affects layout, which also
    // means it has no box of its own — measure the real bar inside it.
    const bar = topBarRef.current?.firstElementChild;
    if (!bar || !shell) return;
    const apply = () => shell.style.setProperty("--admin-topbar-height", `${Math.round(bar.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);

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
    <div ref={shellRef} className={`${styles.shell} ${effectiveCollapsed ? styles.collapsed : ""}`}>
      {isMobile && mobileOpen && <div className={styles.backdrop} onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <AdminSidebar
        collapsed={effectiveCollapsed}
        mobileOpen={mobileOpen}
        onToggleCollapse={handleToggle}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className={styles.main}>
        <div ref={topBarRef} className={styles.topBarSlot}>
          <AdminTopBar onMobileMenuOpen={() => setMobileOpen(true)} />
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
