import type { SVGProps } from "react";

export function VisaIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 32" role="img" aria-label="Visa" {...props}>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <rect x="0.5" y="0.5" width="47" height="31" rx="3.5" fill="none" stroke="#E2E2E2" />
      <text x="24" y="21" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="13" fill="#1A1F71">VISA</text>
    </svg>
  );
}

export function MastercardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 32" role="img" aria-label="Mastercard" {...props}>
      <rect width="48" height="32" rx="4" fill="#fff" />
      <rect x="0.5" y="0.5" width="47" height="31" rx="3.5" fill="none" stroke="#E2E2E2" />
      <circle cx="20" cy="16" r="9" fill="#EB001B" />
      <circle cx="28" cy="16" r="9" fill="#F79E1B" />
      <path d="M24 8.8a9 9 0 0 1 0 14.4 9 9 0 0 1 0-14.4z" fill="#FF5F00" />
    </svg>
  );
}

export function AmexIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 48 32" role="img" aria-label="American Express" {...props}>
      <rect width="48" height="32" rx="4" fill="#1F72CD" />
      <text x="24" y="20" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="10" letterSpacing="1" fill="#fff">AMEX</text>
    </svg>
  );
}
