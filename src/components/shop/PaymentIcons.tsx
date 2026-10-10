import styles from "./PaymentIcons.module.css";

/**
 * Small marks for the ways a customer can pay, shown under the product page's
 * "secure payment" trust badge.
 *
 * Only what is accepted on every order: card payments through Stripe take
 * Visa, Mastercard and American Express, and the payment form switches Apple
 * Pay and Google Pay on (they appear on devices that support them). PayPal,
 * Klarna and other local methods depend on what the Stripe dashboard enables,
 * so they are not promised here — add them to METHODS once they are.
 *
 * Drawn inline rather than loaded: five tiny SVGs, no requests, no package.
 * They are simplified marks sized for ~20px, not the brands' artwork files.
 */
const METHODS: { name: string; mark: React.ReactNode }[] = [
  {
    name: "Visa",
    mark: (
      <text x="17" y="14.6" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9" fontWeight="800" fontStyle="italic" fill="#1A1F71">
        VISA
      </text>
    ),
  },
  {
    name: "Mastercard",
    mark: (
      <>
        <circle cx="14" cy="11" r="7" fill="#EB001B" />
        <circle cx="20" cy="11" r="7" fill="#F79E1B" />
        {/* The overlap of the two circles. */}
        <path d="M17 4.68A7 7 0 0 1 17 17.32A7 7 0 0 1 17 4.68Z" fill="#FF5F00" />
      </>
    ),
  },
  {
    name: "American Express",
    mark: (
      <>
        <rect x="1" y="1" width="32" height="20" rx="3" fill="#006FCF" />
        <text x="17" y="14.2" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="7.4" fontWeight="800" fill="#fff" letterSpacing="0.2">
          AMEX
        </text>
      </>
    ),
  },
  {
    name: "Apple Pay",
    mark: (
      <>
        <rect x="1" y="1" width="32" height="20" rx="3" fill="#000" />
        <path
          d="M10.9 11.6c0-1.3 1-1.9 1.1-2-.6-.9-1.6-1-1.9-1-.8-.1-1.6.5-2 .5-.4 0-1-.5-1.7-.5-.9 0-1.7.5-2.1 1.3-.9 1.6-.2 3.9.6 5.2.4.6.9 1.3 1.6 1.3.6 0 .9-.4 1.6-.4.8 0 1 .4 1.7.4.7 0 1.1-.6 1.5-1.3.5-.7.7-1.4.7-1.4s-1.1-.5-1.1-2.1zM9.6 7.5c.3-.4.6-1 .5-1.5-.5 0-1.1.3-1.4.7-.3.4-.6.9-.5 1.5.6 0 1.1-.3 1.4-.7z"
          fill="#fff"
        />
        <text x="22.5" y="14.6" textAnchor="middle" fontFamily="-apple-system, 'SF Pro Text', Arial, sans-serif" fontSize="8.2" fontWeight="600" fill="#fff">
          Pay
        </text>
      </>
    ),
  },
  {
    name: "Google Pay",
    mark: (
      <text x="17" y="14.6" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="8.2" fontWeight="700">
        <tspan fill="#4285F4">G</tspan>
        <tspan fill="#5F6368"> Pay</tspan>
      </text>
    ),
  },
];

export default function PaymentIcons({ label, className }: { label: string; className?: string }) {
  return (
    <span className={className ? `${styles.row} ${className}` : styles.row} role="img" aria-label={`${label}: ${METHODS.map((m) => m.name).join(", ")}`}>
      {METHODS.map((m) => (
        <svg key={m.name} className={styles.icon} viewBox="0 0 34 22" aria-hidden="true" focusable="false">
          <rect x="0.5" y="0.5" width="33" height="21" rx="3.5" fill="#fff" stroke="#D9DCE1" />
          {m.mark}
        </svg>
      ))}
    </span>
  );
}
