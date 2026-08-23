import ui from "@/components/admin/ui/admin-ui.module.css";

export default function DeliveryRulesPage() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Delivery Rules</h1>
        <span className={ui.badgeInactive}>Coming soon</span>
      </div>

      <div className={ui.card}>
        <div className={ui.emptyState} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem", padding: "3rem 1rem" }}>
          <p style={{ fontWeight: 600, color: "var(--foreground)" }}>Advanced delivery rules are in development</p>
          <p style={{ maxWidth: 420, textAlign: "center" }}>
            Weight-based pricing and carrier integrations are coming soon. Zone surcharges, free shipping thresholds, and delivery estimates are configurable from Shipping Config.
          </p>
        </div>
      </div>
    </div>
  );
}
