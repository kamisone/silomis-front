"use client";

import { usePathname } from "next/navigation";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./index";

/** For client components not otherwise passed a `locale` prop — reads it back out of the URL. */
export function useLocale(): Locale {
  const pathname = usePathname();
  const segment = pathname?.split("/")[1] ?? "";
  return LOCALES.includes(segment as Locale) ? (segment as Locale) : DEFAULT_LOCALE;
}
