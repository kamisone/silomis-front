"use client";

import { useCookieConsent } from "./CookieConsentContext";

interface Props {
  label: string;
  className?: string;
}

export default function CookieSettingsButton({ label, className }: Props) {
  const { openSettings } = useCookieConsent();
  return (
    <button type="button" onClick={openSettings} className={className}>
      {label}
    </button>
  );
}
