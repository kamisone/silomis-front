import type { Metadata } from "next";
import Link from "next/link";
import { PackageX } from "lucide-react";
import SendInWizard, { type SendInConfig } from "./SendInWizard";
import type { EditorConfig } from "@/lib/shop/embroidery";
import { isValidLocale, DEFAULT_LOCALE, getTranslations } from "@/lib/i18n";
import styles from "./SendIn.module.css";

const API_BASE_URL = process.env.API_BASE_URL_SERVER ?? "http://127.0.0.1:4000";

interface PageProps {
  params: Promise<{ locale: string }>;
}

function langParam(locale: string): string {
  return locale !== DEFAULT_LOCALE ? `?lang=${locale}` : "";
}

async function fetchSendInConfig(locale: string): Promise<SendInConfig | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/send-in/config${langParam(locale)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as SendInConfig | { available: false };
    return "available" in data ? null : data;
  } catch {
    return null;
  }
}

async function fetchEditorConfig(productId: string, locale: string): Promise<EditorConfig | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/shop/personalization/config/${productId}${langParam(locale)}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as EditorConfig | { available: false };
    return "available" in data ? null : data;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const safeLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = getTranslations(safeLocale);
  return { title: t.sendIn.metaTitle, description: t.sendIn.intro };
}

/**
 * Embroidery on an item the customer already owns.
 *
 * The same editor as a catalogue cap, fed the customer's own photograph
 * instead of the shop's: they say what the item is, upload a photo, frame the
 * panel and measure it, and from there it is the ordinary design → basket →
 * checkout path. The item follows by post.
 */
export default async function SendInPage({ params }: PageProps) {
  const { locale } = await params;
  const safeLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const t = getTranslations(safeLocale);

  const config = await fetchSendInConfig(safeLocale);
  const editorConfig = config ? await fetchEditorConfig(config.productId, safeLocale) : null;

  if (!config || !editorConfig) {
    // The service is switched off (or not set up): a proper notice, not a
    // blank page — the customer landed here from a link, and should leave
    // knowing what the page is and where to go instead.
    return (
      <div className={styles.unavailable}>
        <div className={styles.unavailableCard}>
          <span className={styles.unavailableIcon} aria-hidden="true">
            <PackageX size={28} />
          </span>
          <span className={styles.eyebrow}>{t.sendIn.eyebrow}</span>
          <h1 className={styles.unavailableTitle}>{t.sendIn.unavailableTitle}</h1>
          <p className={styles.unavailableBody}>{t.sendIn.unavailableBody}</p>
          <div className={styles.unavailableActions}>
            <Link href={`/${safeLocale}`} className={styles.unavailableCta}>
              {t.sendIn.unavailableCta}
            </Link>
            <Link href={`/${safeLocale}/contact`} className={styles.unavailableLink}>
              {t.sendIn.unavailableContact}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <SendInWizard locale={safeLocale} config={config} editorConfig={editorConfig} />;
}
