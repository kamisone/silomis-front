import type { SVGProps } from "react";

export function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Instagram" fill="none" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="Facebook" fill="none" {...props}>
      <path
        d="M16 3h-2.5C10.46 3 9 4.46 9 7.5V10H6.5v3H9v8h3v-8h2.7l.5-3H12V7.7c0-.94.46-1.4 1.4-1.4H16V3z"
        fill="currentColor"
      />
    </svg>
  );
}

export function TiktokIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" role="img" aria-label="TikTok" fill="none" {...props}>
      <path
        d="M16.5 3c.3 1.9 1.5 3.4 3.5 3.7v2.7c-1.4.1-2.6-.3-3.5-1v6.2c0 3-2.4 5.4-5.4 5.4S5.7 17.6 5.7 14.6c0-2.9 2.3-5.2 5.1-5.4v2.8c-1.3.2-2.3 1.3-2.3 2.6 0 1.5 1.2 2.6 2.6 2.6s2.6-1.2 2.6-2.6V3h2.8z"
        fill="currentColor"
      />
    </svg>
  );
}
