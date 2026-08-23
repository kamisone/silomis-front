import ui from "@/components/admin/ui/admin-ui.module.css";

export default function CheckoutSettingsPage() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Checkout Settings</h1>
        <span className={ui.badgeInactive}>Coming soon</span>
      </div>

      <div className={ui.card}>
        <div className={ui.emptyState} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "3rem 1rem" }}>
          <p style={{ fontWeight: 600, color: "var(--foreground)" }}>Checkout settings are in development</p>
          <p style={{ maxWidth: 420, textAlign: "center" }}>Configure checkout flow options — required fields, guest checkout, terms acceptance, and address validation.</p>
        </div>
      </div>
    </div>
  );
}
