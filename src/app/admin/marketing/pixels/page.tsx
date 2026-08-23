import PixelSettingsCard from "@/components/admin/marketing/PixelSettingsCard";
import ui from "@/components/admin/ui/admin-ui.module.css";

export default function PixelsPage() {
  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <h1 className={ui.pageTitle}>Pixels</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <PixelSettingsCard
          platform="meta"
          title="Meta Pixel"
          description="Tracks shop activity (page views, product views, cart, checkout, purchases) for Meta Ads Manager audiences and bidding optimization. Only fires after a visitor accepts marketing cookies."
          idLabel="Pixel ID"
          idPlaceholder="e.g. 1234567890123456"
          idPattern={{ source: "^\\d{10,20}$" }}
          idHint="Find it in Meta Events Manager → Data Sources → your Pixel → Settings. This ID is not secret — it's safe to appear in your site's page source."
          idErrorText="Pixel ID must be 10–20 digits."
          serverSideLabel="Conversions API (server-side Purchase tracking)"
          saveUrl="/next-api/admin/platform-settings/meta-pixel"
          statusUrl="/next-api/admin/platform-settings/meta-capi-status"
        />

        <PixelSettingsCard
          platform="tiktok"
          title="TikTok Pixel"
          description="Tracks shop activity (page views, product views, cart, checkout, purchases) for TikTok Ads Manager audiences and bidding optimization. Only fires after a visitor accepts marketing cookies."
          idLabel="Pixel Code"
          idPlaceholder="e.g. DA3FPARC77U2K1LUCIV0"
          idPattern={{ source: "^[A-Z0-9]{10,32}$", flags: "i" }}
          idHint="Find it in TikTok Events Manager → your Pixel → Pixel code. This code is not secret — it's safe to appear in your site's page source."
          idErrorText="Pixel Code must be 10–32 letters/digits."
          serverSideLabel="Events API (server-side Purchase tracking)"
          saveUrl="/next-api/admin/platform-settings/tiktok-pixel"
          statusUrl="/next-api/admin/platform-settings/tiktok-events-api-status"
        />
      </div>
    </div>
  );
}
