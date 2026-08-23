import Link from "next/link";
import Button from "@/components/admin/ui/Button";
import ui from "@/components/admin/ui/admin-ui.module.css";

export default function CouponsPage() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Coupons</h1>
      </div>

      <div className={ui.card}>
        <div className={ui.emptyState} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "3rem 1rem" }}>
          <p style={{ fontWeight: 600, color: "var(--foreground)" }}>Coupon codes are unified with Promotions</p>
          <p style={{ maxWidth: 420, textAlign: "center" }}>
            Create a promotion with trigger set to &quot;coupon&quot; and a code — it will be validated at checkout like any other discount.
          </p>
          <Link href="/admin/shop/promotions">
            <Button>Go to Promotions</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
