"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./LogoutButton.module.css";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    try {
      await fetch("/next-api/auth", { method: "DELETE" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button type="button" className={styles.button} onClick={handleLogout} disabled={loading}>
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}
