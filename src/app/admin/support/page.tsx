import { Suspense } from "react";
import AdminSupport from "@/components/admin/support/AdminSupport";

export default function SupportPage() {
  return (
    <Suspense>
      <AdminSupport />
    </Suspense>
  );
}
