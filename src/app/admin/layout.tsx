import type { Metadata } from "next";
import AdminShell from "@/components/admin/shell/AdminShell";
import TokenRefresher from "@/components/admin/shell/TokenRefresher";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TokenRefresher />
      <AdminShell>{children}</AdminShell>
    </>
  );
}
