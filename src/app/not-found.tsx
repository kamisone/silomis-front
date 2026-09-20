import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";
import NotFoundView from "@/components/NotFoundView";
import { DEFAULT_LOCALE, getTranslations, isValidLocale, type Locale } from "@/lib/i18n";
import styles from "./not-found.module.css";

/**
 * The application-wide 404 boundary — Next falls back here for any URL that
 * matches no route in the app.
 *
 * In practice the storefront rarely reaches it: `[locale]/(storefront)` has its
 * own catch-all and its own `not-found.tsx`, so shop URLs are answered inside
 * the commerce layout with the full header and footer. What lands here is
 * everything outside that tree — an unknown /admin or /login path, or a URL
 * the middleware skipped because it contains a dot (`/something.php`).
 *
 * Those requests only get the root layout, so this file supplies the brand bar
 * the storefront layout would otherwise have provided. The page body itself is
 * the same component either way.
 */
export default async function RootNotFound() {
  // Set by the middleware on locale-prefixed routes; absent for /admin and
  // /login, which are English-only by design.
  const raw = (await headers()).get("x-locale") ?? DEFAULT_LOCALE;
  const locale: Locale = isValidLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = getTranslations(locale);

  return (
    <>
      <header className={styles.bar}>
        <Link href={`/${locale}`} className={styles.logo} aria-label={t.nav.logoAriaLabel}>
          <Image src="/assets/logo_silomis_mark.webp" alt="" width={34} height={40} className={styles.logoIcon} priority />
          {/* No S — the mark to its left is the S. See CommerceHeader. */}
          <span className={styles.logoWord} aria-hidden="true">
            ilomis
          </span>
        </Link>
      </header>

      <NotFoundView locale={locale} />
    </>
  );
}
