"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCart } from "@/components/shop/CartContext";
import PriceBreakdown from "@/components/shop/PriceBreakdown";
import PromoCodeInput, { type ValidateCouponResult } from "@/components/shop/PromoCodeInput";
import { getTranslations, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import CountrySelect from "@/components/shop/CountrySelect";
import { pixelTrack, getMetaCookies } from "@/lib/metaPixel";
import { ttqTrack, getTikTokCookies } from "@/lib/tiktokPixel";
import styles from "./Checkout.module.css";

type T = ReturnType<typeof getTranslations>;

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

function centsToEuros(c: number) {
  return (c / 100).toFixed(2);
}

interface CountryOption {
  isoCode: string;
  name: string;
}

interface ShippingMethod {
  id: string;
  name: string;
  description: string | null;
  carrier: string | null;
  priceCents: number;
  originalPriceCents: number;
  isFree: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
}

interface CheckoutSnapshot {
  orderId: string;
  orderNumber: string;
  status: string;
  subtotalCents: number;
  shippingCents: number;
  discountCents: number;
  categoryDiscountCents: number;
  couponCode: string | null;
  totalCents: number;
  freeShipping: boolean;
  shippingMethodId: string | null;
  shippingMethods: ShippingMethod[];
  reservationExpiresAt: string | null;
  trackingToken: string | null;
}

type Step = "address" | "shipping" | "payment";

interface FormState {
  email: string;
  firstName: string;
  lastName: string;
  companyName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  zip: string;
  country: string;
  couponCode: string | null;
}

const EMPTY_FORM: FormState = {
  email: "",
  firstName: "",
  lastName: "",
  companyName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  zip: "",
  country: "",
  couponCode: null,
};

// ── Reservation countdown ──────────────────────────────────────────────

function ReservationTimer({ expiresAt, onExpire, t }: { expiresAt: string; onExpire?: () => void; t: T }) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(diff / 1000));
  });

  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [remaining]);

  const expiredFiredRef = useRef(false);
  useEffect(() => {
    if (remaining <= 0 && !expiredFiredRef.current) {
      expiredFiredRef.current = true;
      onExpire?.();
    }
  }, [remaining, onExpire]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const urgent = remaining < 300;

  return (
    <p className={`${styles.reservationTimer} ${urgent ? styles.reservationUrgent : ""}`}>
      {remaining > 0 ? `${t.shop.reservedForPrefix} ${minutes}:${String(seconds).padStart(2, "0")}` : t.shop.reservationExpiredMsg}
    </p>
  );
}

// ── Stripe payment form ──────────────────────────────────────────────

function StripePaymentForm({ orderNumber, orderId, total, trackingToken, locale, t }: { orderNumber: string; orderId: string; total: number; trackingToken?: string | null; locale: Locale; t: T }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setError("");

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment error");
      setPaying(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/${locale}/shop/checkout/success?order=${orderNumber}&id=${orderId}${trackingToken ? `&token=${trackingToken}` : ""}`,
      },
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handlePay} className={styles.stripeForm}>
      <PaymentElement />
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button type="submit" disabled={paying || !stripe} className={styles.payBtn}>
        {paying ? t.shop.processing : `${t.shop.payPrefix}${centsToEuros(total)}`}
      </button>
    </form>
  );
}

// ── Step indicator ──────────────────────────────────────────────────

function StepIndicator({ current, onStepClick, t }: { current: Step; onStepClick: (step: Step) => void; t: T }) {
  const STEP_LABELS: Record<Step, string> = { address: t.shop.stepAddress, shipping: t.shop.stepShipping, payment: t.shop.stepPayment };
  const steps: Step[] = ["address", "shipping", "payment"];
  const currentIdx = steps.indexOf(current);

  return (
    <div className={styles.steps}>
      {steps.map((s, i) => {
        const done = currentIdx > i;
        const active = current === s;
        const clickable = done;
        return (
          <div key={s} className={styles.stepItem}>
            <button
              type="button"
              className={`${styles.stepBtn} ${clickable ? styles.stepBtnClickable : ""}`}
              onClick={clickable ? () => onStepClick(s) : undefined}
              aria-current={active ? "step" : undefined}
              tabIndex={clickable ? 0 : -1}
            >
              <div className={`${styles.stepDot} ${active ? styles.stepDotActive : done ? styles.stepDotDone : ""}`}>
                {done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className={`${styles.stepLabel} ${active ? styles.stepLabelActive : done ? styles.stepLabelDone : ""}`}>{STEP_LABELS[s]}</span>
            </button>
            {i < steps.length - 1 && <div className={`${styles.stepLine} ${done ? styles.stepLineDone : ""}`} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Session persistence (sessionStorage, keyed by cart token) ────────

interface CheckoutPersistedState {
  step: Step;
  form: FormState;
  snapshot: CheckoutSnapshot | null;
  selectedMethodId: string | null;
  clientSecret: string | null;
}

export function persistKey(cartToken: string) {
  return `checkout:${cartToken}`;
}

export function saveCheckoutSession(cartToken: string | null, state: CheckoutPersistedState) {
  if (!cartToken) return;
  try {
    sessionStorage.setItem(persistKey(cartToken), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function loadCheckoutSession(cartToken: string | null): CheckoutPersistedState | null {
  if (!cartToken) return null;
  try {
    const raw = sessionStorage.getItem(persistKey(cartToken));
    return raw ? (JSON.parse(raw) as CheckoutPersistedState) : null;
  } catch {
    return null;
  }
}

function clearCheckoutSession(cartToken: string | null) {
  if (!cartToken) return;
  try {
    sessionStorage.removeItem(persistKey(cartToken));
  } catch {
    // ignore
  }
}

// ── Main checkout page ─────────────────────────────────────────────────

export default function CheckoutPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { cart, token } = useCart();

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [step, setStep] = useState<Step>("address");
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [nameGroupError, setNameGroupError] = useState("");
  const [restoring, setRestoring] = useState(true);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [couponPreviewCents, setCouponPreviewCents] = useState<number | null>(null);

  const [shippingUpdating, setShippingUpdating] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  // Persist state to sessionStorage whenever key values change
  useEffect(() => {
    if (restoring) return;
    saveCheckoutSession(token, { step, form, snapshot, selectedMethodId, clientSecret });
  }, [step, form, snapshot, selectedMethodId, clientSecret, token, restoring]);

  // Debounced sync of form + step to the DB checkout session — lets an
  // abandoned-cart link (or a different device) resume the same state.
  // Fire-and-forget — never blocks the UI.
  useEffect(() => {
    if (restoring || !token) return;
    const tid = setTimeout(() => {
      fetch("/next-api/public/shop/checkout/session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartToken: token,
          step,
          orderId: snapshot?.orderId ?? null,
          formSnapshot: form,
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(tid);
  }, [form, step, snapshot?.orderId, token, restoring]);

  // Restore persisted state on mount
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = loadCheckoutSession(token);
      if (saved && saved.step !== "address") {
        setForm(saved.form);
        setSnapshot(saved.snapshot);
        setSelectedMethodId(saved.selectedMethodId);

        if (saved.step === "payment" && saved.snapshot) {
          // Re-establish payment readiness — ready-for-payment is idempotent,
          // so calling it again is safe even if the order already advanced.
          fetch(`/next-api/public/shop/checkout/${saved.snapshot.orderId}/ready-for-payment`, { method: "POST" })
            .then((r) => (r.ok ? fetch("/next-api/public/shop/payment/intent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: saved.snapshot!.orderId }) }) : Promise.reject()))
            .then((r) => (r && r.ok ? r.json() : Promise.reject()))
            .then((data) => {
              if (data?.clientSecret) {
                setClientSecret(data.clientSecret);
                setStep("payment");
              } else {
                setStep("shipping");
              }
            })
            .catch(() => setStep("shipping"))
            .finally(() => setRestoring(false));
          return;
        }

        setStep(saved.step);
      }
      setRestoring(false);
    }, 0);
    return () => clearTimeout(t);
  }, [token]);

  // ?lang= applies the admin's per-country name overlays; the backend leaves
  // the base name in place for any country that has no translation yet.
  useEffect(() => {
    fetch(`/next-api/public/shop/countries?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setCountries(data);
      })
      .catch(() => {})
      .finally(() => setCountriesLoading(false));
  }, [locale]);

  function goToStep(s: Step) {
    setStep(s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleReservationExpired() {
    clearCheckoutSession(token);
    setSnapshot(null);
    setClientSecret(null);
    setSelectedMethodId(null);
    setFormError(t.shop.reservationExpiredNotice);
    goToStep("address");
  }

  function handleStepClick(s: Step) {
    setFormError("");
    setNameGroupError("");
    if (s === "address") {
      setClientSecret(null);
      goToStep("address");
    } else if (s === "shipping" && snapshot) {
      setClientSecret(null);
      goToStep("shipping");
    }
  }

  async function handleSubmitAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!cart?.items.length) return;

    const hasName = form.firstName.trim() && form.lastName.trim();
    const hasCompany = form.companyName.trim();
    if (!hasName && !hasCompany) {
      setNameGroupError(t.shop.nameOrCompanyRequired);
      return;
    }
    setNameGroupError("");

    setSubmitting(true);
    setFormError("");

    const res = await fetch("/next-api/public/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartToken: token,
        email: form.email,
        firstName: form.firstName || null,
        lastName: form.lastName || null,
        companyName: form.companyName || null,
        phone: form.phone || null,
        line1: form.line1,
        line2: form.line2 || null,
        city: form.city,
        zip: form.zip,
        country: form.country,
        couponCode: form.couponCode || null,
        ...getMetaCookies(),
        ...getTikTokCookies(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = typeof err?.message === "string" ? err.message : t.shop.checkoutStartError;
      setFormError(msg);
      setSubmitting(false);
      return;
    }

    const snap: CheckoutSnapshot = await res.json();
    setSnapshot(snap);

    // Meta Pixel: value/currency/ids only — never add customer PII here.
    // eventId shared with the server-side Conversions API call for this same
    // order (sent from the backend's ORDER_CREATED listener) for dedup.
    pixelTrack(
      "InitiateCheckout",
      {
        value: snap.totalCents / 100,
        currency: "EUR",
        content_type: "product",
        content_ids: cart.items.map((i) => i.variantId),
        num_items: cart.items.reduce((n, i) => n + i.quantity, 0),
      },
      snap.orderNumber,
    );
    // TikTok: same order number as the event ID — matches the backend's
    // server-side InitiateCheckout call (ORDER_CREATED listener) for dedup.
    ttqTrack(
      "InitiateCheckout",
      {
        contents: cart.items.map((i) => ({
          content_id: i.variantId,
          content_type: "product",
          content_name: i.titleSnapshot,
          quantity: i.quantity,
          price: i.unitPriceCents / 100,
        })),
        value: snap.totalCents / 100,
        currency: "EUR",
      },
      snap.orderNumber,
    );

    if (snap.shippingMethods.length > 0) {
      const firstId = snap.shippingMethods[0].id;
      setSelectedMethodId(firstId);
      await applyShippingMethod(snap.orderId, firstId, snap);
    } else {
      goToStep("shipping");
    }
    setSubmitting(false);
  }

  async function handleValidateCoupon(code: string): Promise<ValidateCouponResult> {
    try {
      const res = await fetch(`/next-api/public/shop/checkout/validate-coupon?code=${encodeURIComponent(code)}&cartToken=${encodeURIComponent(token ?? "")}`);
      if (!res.ok) {
        return { valid: false, discountCents: 0, freeShipping: false, reason: "invalid" };
      }
      return (await res.json()) as ValidateCouponResult;
    } catch {
      return { valid: false, discountCents: 0, freeShipping: false, reason: "invalid" };
    }
  }

  function handleApplyCoupon(code: string, result: ValidateCouponResult) {
    setForm((f) => ({ ...f, couponCode: code }));
    setCouponPreviewCents(result.discountCents);
  }

  function handleRemoveCoupon() {
    setForm((f) => ({ ...f, couponCode: null }));
    setCouponPreviewCents(null);
  }

  async function applyShippingMethod(orderId: string, methodId: string, currentSnap?: CheckoutSnapshot) {
    setShippingUpdating(true);
    const res = await fetch(`/next-api/public/shop/checkout/${orderId}/shipping`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingMethodId: methodId }),
    });
    if (res.ok) {
      const updated: CheckoutSnapshot = await res.json();
      setSnapshot(updated);
      setSelectedMethodId(updated.shippingMethodId ?? methodId);
      if (currentSnap) goToStep("shipping");
    }
    setShippingUpdating(false);
  }

  /**
   * Free shipping hides the radio list, so the customer has no manual way to
   * pick a method. If the selection is ever missing at that point — a resumed
   * session, back-navigation, a failed PATCH — apply the standard (free) method
   * automatically so Continue isn't stuck disabled with nothing to fix it.
   */
  useEffect(() => {
    if (step !== "shipping" || !snapshot?.freeShipping) return;
    if (selectedMethodId || shippingUpdating) return;
    const standard = snapshot.shippingMethods.find((m) => m.isFree) ?? snapshot.shippingMethods[0];
    if (!standard) return;
    const t = setTimeout(() => {
      setSelectedMethodId(standard.id);
      applyShippingMethod(snapshot.orderId, standard.id);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, snapshot, selectedMethodId, shippingUpdating]);

  async function handleConfirmShipping(e: React.FormEvent) {
    e.preventDefault();
    if (!snapshot || !selectedMethodId) return;
    setSubmitting(true);
    setFormError("");

    if (snapshot.shippingMethodId !== selectedMethodId) {
      await applyShippingMethod(snapshot.orderId, selectedMethodId);
    }

    const readyRes = await fetch(`/next-api/public/shop/checkout/${snapshot.orderId}/ready-for-payment`, { method: "POST" });
    if (!readyRes.ok) {
      setFormError(t.shop.shippingPrepError);
      setSubmitting(false);
      return;
    }

    const intentRes = await fetch("/next-api/public/shop/payment/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: snapshot.orderId }),
    });
    if (!intentRes.ok) {
      setFormError(t.shop.paymentStartError);
      setSubmitting(false);
      return;
    }

    const { clientSecret: cs, metaAddPaymentInfoEventId, tiktokAddPaymentInfoEventId } = await intentRes.json();
    setClientSecret(cs);

    // Same event IDs the backend's own AddPaymentInfo call used (fired from
    // ShopPaymentService.createPaymentIntent) — matches the browser+server
    // pair for Meta/TikTok dedup.
    if (metaAddPaymentInfoEventId) {
      pixelTrack(
        "AddPaymentInfo",
        {
          value: snapshot.totalCents / 100,
          currency: "EUR",
          content_type: "product",
          content_ids: cart?.items.map((i) => i.variantId) ?? [],
        },
        metaAddPaymentInfoEventId,
      );
    }
    if (tiktokAddPaymentInfoEventId) {
      ttqTrack(
        "AddPaymentInfo",
        {
          contents: (cart?.items ?? []).map((i) => ({
            content_id: i.variantId,
            content_type: "product",
            content_name: i.titleSnapshot,
            quantity: i.quantity,
            price: i.unitPriceCents / 100,
          })),
          value: snapshot.totalCents / 100,
          currency: "EUR",
        },
        tiktokAddPaymentInfoEventId,
      );
    }

    goToStep("payment");
    setSubmitting(false);
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyCard}>
          <div className={styles.emptyIconBadge}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
          </div>
          <h2 className={styles.emptyTitle}>{t.shop.checkoutEmpty}</h2>
          <p className={styles.emptySub}>{t.shop.checkoutEmptySub}</p>
          <Link href={`/${locale}/shop`} className={styles.emptyCta}>
            {t.shop.continueShopping}
          </Link>
        </div>
      </div>
    );
  }

  if (restoring) {
    return <div className={styles.container} style={{ textAlign: "center", padding: "80px 0" }} />;
  }

  const onAddressStep = step === "address";
  const breakdownSubtotal = snapshot?.subtotalCents ?? cart.subtotalCents;
  const breakdownShipping = onAddressStep ? undefined : snapshot?.shippingCents;
  // Pre-order, the coupon preview from validate-coupon is the only discount
  // knowledge available (automatic/category promotions only resolve once the
  // order exists) — reflect it in the total so the input's preview and the
  // summary agree; the backend recomputes authoritatively on submit anyway.
  const breakdownDiscount = onAddressStep ? (couponPreviewCents ?? undefined) : snapshot?.discountCents;
  const breakdownCouponCode = onAddressStep ? form.couponCode : snapshot?.couponCode;
  const breakdownTotal = onAddressStep ? Math.max(0, cart.subtotalCents - (couponPreviewCents ?? 0)) : (snapshot?.totalCents ?? cart.subtotalCents);
  const shippingMethods = snapshot?.shippingMethods ?? [];

  const freeShippingUpgrades = snapshot?.freeShipping ? shippingMethods.filter((m) => !m.isFree) : [];
  const freeShippingMethod = snapshot?.freeShipping ? (shippingMethods.find((m) => m.isFree) ?? null) : null;

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{t.shop.checkoutTitle}</h1>
      <StepIndicator current={step} onStepClick={handleStepClick} t={t} />

      <div className={styles.layout}>
        {/* ── Left: step form ── */}
        <div className={styles.formSection}>
          {/* STEP 1 — Address */}
          {step === "address" && (
            <form onSubmit={handleSubmitAddress}>
              <h2 className={styles.sectionTitle}>{t.shop.contactInfo}</h2>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>
                    {t.shop.firstName}
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input
                    value={form.firstName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, firstName: e.target.value }));
                      setNameGroupError("");
                    }}
                  />
                </div>
                <div className={styles.field}>
                  <label>
                    {t.shop.lastName}
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input
                    value={form.lastName}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, lastName: e.target.value }));
                      setNameGroupError("");
                    }}
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label>{t.shop.companyNameOptional}</label>
                <input
                  value={form.companyName}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, companyName: e.target.value }));
                    setNameGroupError("");
                  }}
                />
              </div>
              <p className={styles.requiredNote}>{t.shop.requiredNote}</p>
              {nameGroupError && (
                <p className={styles.error} role="alert">
                  {nameGroupError}
                </p>
              )}
              <div className={styles.field}>
                <label>
                  {t.shop.emailLabel}
                  <span className={styles.requiredMark}> *</span>
                </label>
                <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>{t.shop.phoneOptional}</label>
                <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>

              <h2 className={styles.sectionTitle}>{t.shop.shippingAddressTitle}</h2>
              <div className={styles.field}>
                <label>
                  {t.shop.countryLabel}
                  <span className={styles.requiredMark}> *</span>
                </label>
                <CountrySelect
                  countries={countries}
                  value={form.country}
                  onChange={(isoCode) => setForm((f) => ({ ...f, country: isoCode }))}
                  disabled={countriesLoading}
                  required
                  placeholder={countriesLoading ? t.shop.loading : t.shop.selectCountryPlaceholder}
                  searchPlaceholder={t.shop.countrySearchPlaceholder}
                  noResultsLabel={t.shop.countryNoResults}
                  ariaLabel={t.shop.countryLabel}
                />
              </div>
              <div className={styles.field}>
                <label>
                  {t.shop.addressLine1}
                  <span className={styles.requiredMark}> *</span>
                </label>
                <input required value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
              </div>
              <div className={styles.field}>
                <label>{t.shop.addressLine2}</label>
                <input value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
              </div>
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>
                    {t.shop.cityLabel}
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div className={styles.field}>
                  <label>
                    {t.shop.zipLabel}
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input required value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} />
                </div>
              </div>

              {formError && (
                <p className={styles.error} role="alert">
                  {formError}
                </p>
              )}
              <button type="submit" disabled={submitting} className={styles.continueBtn}>
                {submitting ? t.shop.processing : t.shop.continueToShipping}
              </button>
            </form>
          )}

          {/* STEP 2 — Shipping */}
          {step === "shipping" && snapshot && (
            <form onSubmit={handleConfirmShipping}>
              <h2 className={styles.sectionTitle}>{t.shop.shippingMethodTitle}</h2>
              {snapshot.reservationExpiresAt && <ReservationTimer expiresAt={snapshot.reservationExpiresAt} onExpire={handleReservationExpired} t={t} />}
              {shippingMethods.length === 0 && <p className={styles.noOptions}>{t.shop.noShippingOptions}</p>}

              {freeShippingMethod ? (
                <div className={styles.shippingMethods}>
                  <label className={`${styles.freeShippingCard} ${selectedMethodId === freeShippingMethod.id ? styles.freeShippingCardSelected : ""}`}>
                    {freeShippingUpgrades.length > 0 && (
                      <input
                        type="radio"
                        name="shipping"
                        value={freeShippingMethod.id}
                        checked={selectedMethodId === freeShippingMethod.id}
                        onChange={() => {
                          setSelectedMethodId(freeShippingMethod.id);
                          applyShippingMethod(snapshot.orderId, freeShippingMethod.id);
                        }}
                      />
                    )}
                    <span className={styles.freeShippingCardIcon} aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M3 7h11v8H3z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        <path d="M14 10h3.5L21 13v2h-7z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                        <circle cx="7" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="17" cy="17.5" r="1.8" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    </span>
                    <span className={styles.freeShippingCardBody}>
                      <span className={styles.freeShippingCardTitle}>{t.shop.freeShippingBadge}</span>
                      <span className={styles.freeShippingCardMeta}>
                        {freeShippingMethod.estimatedDaysMin}–{freeShippingMethod.estimatedDaysMax} {t.shop.days}
                      </span>
                    </span>
                  </label>

                  {freeShippingUpgrades.map((up) => (
                    <label key={up.id} className={`${styles.shippingOption} ${selectedMethodId === up.id ? styles.shippingOptionSelected : ""}`}>
                      <input
                        type="radio"
                        name="shipping"
                        value={up.id}
                        checked={selectedMethodId === up.id}
                        onChange={() => {
                          setSelectedMethodId(up.id);
                          applyShippingMethod(snapshot.orderId, up.id);
                        }}
                      />
                      <span className={styles.shippingName}>{up.name}</span>
                      <span className={styles.shippingDays}>
                        {up.estimatedDaysMin}–{up.estimatedDaysMax} {t.shop.days}
                      </span>
                      <span className={styles.shippingPrice}>€{centsToEuros(up.priceCents)}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className={styles.shippingMethods}>
                  {shippingMethods.map((m) => (
                    <label key={m.id} className={`${styles.shippingOption} ${selectedMethodId === m.id ? styles.shippingOptionSelected : ""}`}>
                      <input
                        type="radio"
                        name="shipping"
                        value={m.id}
                        checked={selectedMethodId === m.id}
                        onChange={() => {
                          setSelectedMethodId(m.id);
                          applyShippingMethod(snapshot.orderId, m.id);
                        }}
                      />
                      <span className={styles.shippingName}>{m.name}</span>
                      <span className={styles.shippingDays}>
                        {m.estimatedDaysMin}–{m.estimatedDaysMax} {t.shop.days}
                      </span>
                      <span className={styles.shippingPrice}>
                        {m.isFree ? (
                          <>
                            {m.originalPriceCents > 0 && <span className={styles.shippingPriceStruck}>€{centsToEuros(m.originalPriceCents)}</span>}
                            <span className={styles.freeLabel}>{t.shop.free}</span>
                          </>
                        ) : (
                          `€${centsToEuros(m.priceCents)}`
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className={styles.actionRow}>
                <button type="button" onClick={() => handleStepClick("address")} className={styles.backBtn}>
                  {t.shop.back}
                </button>
                <button type="submit" disabled={submitting || shippingUpdating || !selectedMethodId} className={styles.continueBtn} style={{ flex: 1 }}>
                  {submitting ? t.shop.processing : t.shop.continueToPayment}
                </button>
              </div>
              {formError && (
                <p className={styles.error} role="alert">
                  {formError}
                </p>
              )}
            </form>
          )}

          {/* STEP 3 — Payment */}
          {step === "payment" && snapshot && (
            <div>
              <h2 className={styles.sectionTitle}>{t.shop.paymentTitle}</h2>
              {snapshot.reservationExpiresAt && <ReservationTimer expiresAt={snapshot.reservationExpiresAt} onExpire={handleReservationExpired} t={t} />}
              {clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
                  <StripePaymentForm orderId={snapshot.orderId} orderNumber={snapshot.orderNumber} total={snapshot.totalCents} trackingToken={snapshot.trackingToken} locale={locale} t={t} />
                </Elements>
              )}
            </div>
          )}
        </div>

        {/* ── Right: order summary ── */}
        <div className={styles.summary}>
          <h3>{t.shop.checkoutOrderSummary}</h3>

          <div className={styles.lineItems}>
            {cart.items.map((item) => (
              <div key={item.id} className={styles.summaryItem}>
                <div className={styles.summaryItemImage}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.titleSnapshot} />
                  ) : (
                    <div className={styles.summaryItemImagePlaceholder} />
                  )}
                  {item.quantity > 1 && <span className={styles.summaryItemQtyBadge}>×{item.quantity}</span>}
                </div>
                <span className={styles.summaryItemName}>
                  {item.titleSnapshot}
                  {item.optionsSnapshot && item.optionsSnapshot.length > 0 && (
                    <span className={styles.summaryItemOptions}>{item.optionsSnapshot.map((o) => `${o.attributeName}: ${o.displayValue ?? o.value}`).join(" · ")}</span>
                  )}
                </span>
                <span className={styles.summaryItemPrice}>€{centsToEuros(item.lineTotalCents)}</span>
              </div>
            ))}
          </div>

          {onAddressStep && (
            <div className={styles.summaryPromo}>
              <PromoCodeInput
                onValidate={handleValidateCoupon}
                onApply={handleApplyCoupon}
                onRemove={handleRemoveCoupon}
                appliedCode={form.couponCode}
                appliedDiscountCents={couponPreviewCents ?? undefined}
              />
            </div>
          )}

          <div className={styles.summaryBreakdown}>
            <PriceBreakdown
              locale={locale}
              subtotalCents={breakdownSubtotal}
              shippingCents={breakdownShipping}
              freeShipping={snapshot?.freeShipping ?? cart.freeShipping}
              discountCents={breakdownDiscount}
              couponCode={breakdownCouponCode}
              totalCents={breakdownTotal}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
