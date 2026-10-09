"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Check, Lock } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import type { StripeElementLocale, StripePaymentElementOptions } from "@stripe/stripe-js";
import Image from "next/image";
import { useCart, type CheckoutFields } from "@/components/shop/CartContext";
import PriceBreakdown, { embroideryCentsOf } from "@/components/shop/PriceBreakdown";
import EmbroideryLine from "@/components/shop/EmbroideryLine";
import PersonaliseOffer, { PersonalisedLineActions } from "@/components/shop/PersonaliseOffer";
import PromoCodeInput, { type ValidateCouponResult } from "@/components/shop/PromoCodeInput";
import { getTranslations, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import CountrySelect from "@/components/shop/CountrySelect";
import { pixelTrack, getMetaCookies } from "@/lib/metaPixel";
import { ttqTrack, getTikTokCookies } from "@/lib/tiktokPixel";
import styles from "./Checkout.module.css";
import { recordPaymentMarker } from "@/lib/shop/replayRecorder";
import { orderedErrors, validateAddress, type AddressErrors, type AddressField } from "./addressValidation";
import PhoneVerificationPanel from "./PhoneVerificationPanel";
import PickupPointSelector, { type PickupPoint } from "@/components/shop/PickupPointSelector";

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
  code: string | null;
  name: string;
  description: string | null;
  carrier: string | null;
  priceCents: number;
  originalPriceCents: number;
  isFree: boolean;
  estimatedDaysMin: number;
  estimatedDaysMax: number;
  requiresPickupPoint: boolean;
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
  pickupPoint: PickupPoint | null;
  reservationExpiresAt: string | null;
  trackingToken: string | null;
}

/**
 * "personalise" is an optional first step, present only when the basket holds
 * a plain piece that could still be embroidered — see the step's own comment.
 */
type Step = "personalise" | "address" | "shipping" | "payment";

interface FormState {
  email: string;
  /** The customer's full name, one field. */
  name: string;
  companyName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  zip: string;
  country: string;
  couponCode: string | null;
  /** "Send me reminders by SMS" — unticked by default; consent for reminder texts (the abandoned-cart reminder), not offers. */
  smsOptIn: boolean;
}

const EMPTY_FORM: FormState = {
  email: "",
  name: "",
  companyName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  zip: "",
  country: "",
  couponCode: null,
  smsOptIn: false,
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

/** Stripe's own name for each shop language — "en" alone would be US English. */
const STRIPE_LOCALE: Record<Locale, StripeElementLocale> = {
  en: "en-GB", fr: "fr", es: "es", it: "it", de: "de", nl: "nl", pl: "pl", pt: "pt",
};

/**
 * The payment form offers whatever Stripe offers this customer — cards,
 * Apple Pay / Google Pay, and the local methods the dashboard enables (iDEAL,
 * Bancontact, PayPal, Klarna…) — and asks for nothing the address step
 * already has: name, email and address are handed to Stripe at confirm time.
 * Link is switched off (it asks for a phone code, which reads as signing up
 * for something), and so is the card terms line. A detail the address step
 * did not capture (a resumed checkout with an empty form, say) is left for
 * the form to ask, because a field set to "never" must then be supplied.
 */
function paymentElementOptions(form: FormState): StripePaymentElementOptions {
  const hasName = Boolean(form.name.trim() || form.companyName.trim());
  const hasAddress = Boolean(form.line1.trim() && form.city.trim() && form.zip.trim() && form.country);
  return {
    layout: "tabs",
    // Apple Pay also needs the domain registered in the Stripe dashboard
    // (Settings → Payment method domains) or it silently never appears.
    wallets: { applePay: "auto", googlePay: "auto", link: "never" },
    terms: { card: "never" },
    fields: {
      billingDetails: {
        name: hasName ? "never" : "auto",
        email: form.email.trim() ? "never" : "auto",
        phone: "never",
        address: hasAddress ? "never" : "auto",
      },
    },
  };
}

function billingDetails(form: FormState) {
  const name = form.name.trim() || form.companyName.trim();
  const hasAddress = Boolean(form.line1.trim() && form.city.trim() && form.zip.trim() && form.country);
  return {
    ...(name ? { name } : {}),
    ...(form.email.trim() ? { email: form.email.trim() } : {}),
    phone: form.phone.trim(),
    ...(hasAddress
      ? { address: { line1: form.line1.trim(), line2: form.line2.trim(), city: form.city.trim(), postal_code: form.zip.trim(), state: "", country: form.country } }
      : {}),
  };
}

/**
 * A carrier's brand mark beside its method name, so a customer who knows the
 * relay-point network recognises it at a glance. Matched on the method code
 * the backend seeds (MONDIAL_RELAY_METHOD_CODE), with the carrier name as a
 * fallback for a method the admin created by hand.
 */
function carrierLogo(m: { code: string | null; carrier: string | null }): string | null {
  if (m.code === "mondial_relay" || /mondial\s*relay/i.test(m.carrier ?? "")) return "/assets/carriers/mondial-relay.svg";
  return null;
}

const NO_OPTIONAL_FIELDS: CheckoutFields = { companyName: false, phone: false, addressLine2: false };

/**
 * The form as the customer can see it: a field the basket does not ask for is
 * blanked, so a value restored from an earlier checkout (sessionStorage) or
 * typed before the basket changed is never sent along invisibly.
 */
function visibleForm(form: FormState, ask: CheckoutFields): FormState {
  return {
    ...form,
    companyName: ask.companyName ? form.companyName : "",
    line2: ask.addressLine2 ? form.line2 : "",
  };
}

function StripePaymentForm({ orderNumber, orderId, total, trackingToken, form, locale, t, notice }: { orderNumber: string; orderId: string; total: number; trackingToken?: string | null; form: FormState; locale: Locale; t: T; notice?: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  // A customer back from a bank / PayPal page they left without paying sees
  // why they are here again, until they try once more.
  const [tried, setTried] = useState(false);
  const shownError = error || (!tried && notice) || "";
  const methodRef = useRef<string | null>(null);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements || paying) return;
    setPaying(true);
    setTried(true);
    setError("");
    recordPaymentMarker("submitted", methodRef.current);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      recordPaymentMarker("error", submitError.code ?? submitError.message ?? null);
      setError(submitError.message ?? t.shop.paymentFailed);
      setPaying(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        payment_method_data: { billing_details: billingDetails(form) },
        return_url: `${window.location.origin}/${locale}/shop/checkout/success?order=${orderNumber}&id=${orderId}${trackingToken ? `&token=${trackingToken}` : ""}`,
      },
    });
    if (confirmError) {
      // Stripe's code and message, never anything typed: decline codes are
      // exactly what tells a declined card from a confusing form.
      recordPaymentMarker("error", [confirmError.code, confirmError.decline_code, confirmError.message].filter(Boolean).join(" · ") || null);
      setError(confirmError.message ?? t.shop.paymentFailed);
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handlePay} className={styles.stripeForm}>
      <PaymentElement
        options={paymentElementOptions(form)}
        onReady={() => recordPaymentMarker("form_ready")}
        onLoadError={(e) => recordPaymentMarker("form_load_error", e.error?.message ?? e.error?.type ?? null)}
        onChange={(e) => {
          const method = e.value?.type ?? null;
          if (method && method !== methodRef.current) {
            methodRef.current = method;
            recordPaymentMarker("method_selected", method);
          }
        }}
      />
      {/* Said in our own words, not just Stripe's: an unknown shop asking for
          payment is exactly where people hesitate. */}
      <p className={styles.secureNote}>
        <Lock size={13} aria-hidden="true" />
        {t.shop.securePaymentNote}
      </p>
      {shownError && (
        <p className={styles.error} role="alert">
          {shownError}
        </p>
      )}
      <StickyActionBar>
        <button type="submit" disabled={paying || !stripe} className={styles.payBtn}>
          {paying ? t.shop.processing : `${t.shop.payPrefix}${centsToEuros(total)}`}
        </button>
      </StickyActionBar>
    </form>
  );
}

// ── Field errors ────────────────────────────────────────────────────

/** The line under a field saying what is wrong with it; nothing when fine. */
function FieldError({ id, message }: { id: string; message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className={styles.fieldError}>
      <AlertCircle size={14} aria-hidden="true" />
      {message}
    </p>
  );
}

// ── Sticky action bar ───────────────────────────────────────────────

/** The phone breakpoint the checkout layout collapses to one column at. */
const MOBILE_QUERY = "(max-width: 768px)";

/**
 * The step's main button, pinned to the bottom of the screen on a phone.
 *
 * On a phone the order summary sits above the form, so the button for the
 * step is often a long scroll away — or below the keyboard. Fixed rather than
 * sticky for that reason: sticky only pins while its own form is on screen.
 * Its height is published as --buy-bar-height (the PDP's buy bar uses the
 * same variable) so the back-to-top button and the chat bubble rise above it,
 * and the page reserves the same room at its foot.
 *
 * On a phone the same button is also rendered in place at the end of the
 * step, so a customer who scrolls to the bottom finds it where a form's
 * button usually is. Both copies stay: the pinned one is always in reach.
 * On a desktop the bar is not pinned — it already sits at the end of the
 * step — so the in-place copy is hidden there (.inlineAction). Rendering the
 * children twice is safe because they are plain buttons: no ids, no refs,
 * and a submit button submits its form from either copy.
 */
function StickyActionBar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const mq = window.matchMedia(MOBILE_QUERY);
    const publish = () => root.style.setProperty("--buy-bar-height", mq.matches ? `${el.offsetHeight}px` : "0px");
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    mq.addEventListener("change", publish);
    return () => {
      ro.disconnect();
      mq.removeEventListener("change", publish);
      root.style.setProperty("--buy-bar-height", "0px");
    };
  }, []);
  return (
    <>
      <div className={styles.inlineAction}>{children}</div>
      <div ref={ref} className={styles.stickyAction}>
        {children}
      </div>
    </>
  );
}

// ── Step indicator ──────────────────────────────────────────────────

function StepIndicator({ current, onStepClick, showPersonalise, t }: { current: Step; onStepClick: (step: Step) => void; showPersonalise: boolean; t: T }) {
  const STEP_LABELS: Record<Step, string> = { personalise: t.personalize.stepLabel, address: t.shop.stepAddress, shipping: t.shop.stepShipping, payment: t.shop.stepPayment };
  const steps: Step[] = showPersonalise ? ["personalise", "address", "shipping", "payment"] : ["address", "shipping", "payment"];
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
  /** The personalise step was part of this checkout — keeps it on the step rail after it is left. */
  personaliseInFlow?: boolean;
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

/**
 * A form saved before the checkout asked for one name carries `firstName` and
 * `lastName` instead — from this tab's sessionStorage, or from a resume link's
 * server snapshot. Joined into `name`, so it resumes filled in.
 */
function withSingleName(form: FormState & { firstName?: string; lastName?: string }): FormState {
  const { firstName, lastName, ...rest } = form;
  const joined = [firstName, lastName].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
  return { ...EMPTY_FORM, ...rest, name: rest.name?.trim() ? rest.name : joined };
}

function loadCheckoutSession(cartToken: string | null): CheckoutPersistedState | null {
  if (!cartToken) return null;
  try {
    const raw = sessionStorage.getItem(persistKey(cartToken));
    if (!raw) return null;
    const state = JSON.parse(raw) as CheckoutPersistedState;
    return { ...state, form: withSingleName(state.form) };
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
  // Company and address line 2 are hidden unless a product in the
  // basket asks for them (admin › product › Checkout fields).
  const ask = cart?.checkoutFields ?? NO_OPTIONAL_FIELDS;

  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(true);
  const [step, setStep] = useState<Step>("address");
  const [personaliseInFlow, setPersonaliseInFlow] = useState(false);
  /** The saved session as read on mount — decides whether to open on the personalise step. */
  const savedSession = useRef<CheckoutPersistedState | null>(null);
  const landed = useRef(false);
  const [snapshot, setSnapshot] = useState<CheckoutSnapshot | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  /**
   * The phone and country the shop asked to confirm by code, or null. Keyed
   * on both: a customer who edits either after the code went out needs a
   * code for the new number, so the panel closes and the next submit asks
   * again.
   */
  const [verifyFor, setVerifyFor] = useState<{ phone: string; country: string } | null>(null);
  // Errors are shown only once the customer has tried to continue — never
  // while they are still typing a field for the first time — and from then on
  // they follow the form live, so each one clears the moment it is fixed.
  const [addressAttempted, setAddressAttempted] = useState(false);
  const [restoring, setRestoring] = useState(true);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [couponPreviewCents, setCouponPreviewCents] = useState<number | null>(null);

  const [shippingUpdating, setShippingUpdating] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  // Persist state to sessionStorage whenever key values change
  useEffect(() => {
    if (restoring) return;
    saveCheckoutSession(token, { step, personaliseInFlow, form, snapshot, selectedMethodId, clientSecret });
  }, [step, personaliseInFlow, form, snapshot, selectedMethodId, clientSecret, token, restoring]);

  /**
   * Checkout opens on the personalise step whenever the basket holds a piece
   * that takes embroidery — plain (the customer skipped, or never saw,
   * "Personalise this piece") or already embroidered, wherever that was done
   * (product page, drawer, basket): the step is where the design is checked,
   * changed or removed before the address.
   *
   * Not only on a brand-new checkout: earlier progress saved in this tab (an
   * address typed last visit) used to switch it off for good, and anyone who
   * had opened checkout once never saw the step. It is skipped only when the
   * customer has already been through it in this checkout, or is resuming
   * further along (shipping, payment).
   */
  useEffect(() => {
    if (restoring || !cart || landed.current) return;
    landed.current = true;
    const saved = savedSession.current;
    const alreadySeen = !!saved?.personaliseInFlow;
    const resumingLater = saved?.step === "shipping" || saved?.step === "payment";
    if (!alreadySeen && !resumingLater && step === "address" && cart.items.some((i) => i.personalizable)) {
      setPersonaliseInFlow(true);
      setStep("personalise");
    }
  }, [restoring, cart, step]);

  // Re-quote whenever the snapshot in hand was not produced in the language
  // being read.
  //
  // Two ways that happens, and both showed the shipping step's method names in
  // the wrong language. A visitor switches language mid-checkout, and the
  // order's own locale — written once at the address step — does not follow
  // them. Or the page is reloaded and the snapshot comes back verbatim out of
  // sessionStorage, carrying whatever names were quoted when it was cached,
  // possibly days earlier and before the order's locale was ever set right.
  //
  // Null rather than the current locale, so a restored snapshot (which never
  // sets it) is always re-quoted once; the address POST sets it, so the
  // snapshot that call just returned is not fetched twice.
  const quotedLocale = useRef<string | null>(null);
  useEffect(() => {
    const orderId = snapshot?.orderId;
    if (restoring || !orderId || quotedLocale.current === locale) return;
    quotedLocale.current = locale;
    let cancelled = false;
    fetch(`/next-api/public/shop/checkout/${orderId}?lang=${locale}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((snap: CheckoutSnapshot) => {
        if (!cancelled) setSnapshot(snap);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [locale, snapshot?.orderId, restoring]);

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
          // The server's checkout session knows the three classic steps; the
          // optional personalise step is still "before the address".
          step: step === "personalise" ? "address" : step,
          orderId: snapshot?.orderId ?? null,
          formSnapshot: form,
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(tid);
  }, [form, step, snapshot?.orderId, token, restoring]);

  /**
   * The stock hold's real end, as the payment-intent call reports it: a new
   * intent or a failed attempt restarts it server-side, and a countdown kept
   * from the order's creation would run out early and throw the customer
   * back to the address step while their order is still open.
   */
  function syncReservation(expiresAt: string | null | undefined) {
    if (!expiresAt) return;
    setSnapshot((prev) => (prev ? { ...prev, reservationExpiresAt: expiresAt } : prev));
  }

  // Back from a bank / PayPal / Klarna page the customer left without paying:
  // the success page sends them here with ?payment=failed. Said once, above
  // the form, and dropped from the address bar so a reload does not repeat it.
  const [paymentNotice, setPaymentNotice] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment") !== "failed") return;
    const tid = setTimeout(() => setPaymentNotice(getTranslations(locale).shop.paymentNotCompleted), 0);
    params.delete("payment");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
    return () => clearTimeout(tid);
  }, [locale]);

  // Restore persisted state on mount
  useEffect(() => {
    const t = setTimeout(() => {
      const saved = loadCheckoutSession(token);
      savedSession.current = saved;
      if (saved?.personaliseInFlow) setPersonaliseInFlow(true);
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
                syncReservation(data.reservationExpiresAt);
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
    scrollOnStepChange.current = true;
  }

  /**
   * Back to the top of the page once the new step is on screen.
   *
   * This used to be a smooth scroll started in goToStep, before React had
   * rendered the new step. The customer is usually at the very bottom of a
   * long step when they press Continue; the shorter step then shrank the page
   * under the running animation, phones (Safari especially) cancelled it, and
   * the customer was left looking at the footer. Run here instead — after the
   * new step is in the page, before it is painted — and instant, so there is
   * no frame with the footer and nothing to interrupt.
   *
   * Only for moves made through goToStep: restoring a saved session on load
   * sets the step too, and must not yank a page the visitor is reading.
   */
  const scrollOnStepChange = useRef(false);
  useLayoutEffect(() => {
    if (!scrollOnStepChange.current) return;
    scrollOnStepChange.current = false;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

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
    if (s === "personalise") {
      setClientSecret(null);
      goToStep("personalise");
    } else if (s === "address") {
      setClientSecret(null);
      goToStep("address");
    } else if (s === "shipping" && snapshot) {
      setClientSecret(null);
      goToStep("shipping");
    }
  }

  const addressErrors: AddressErrors = addressAttempted ? validateAddress(visibleForm(form, ask), { companyAllowed: ask.companyName }, t.shop) : {};
  const addressProblems = orderedErrors(addressErrors);

  /**
   * Takes the customer to a field that needs fixing: scrolled to the middle
   * of the screen (clear of the fixed header and, on a phone, the sticky
   * button bar) and focused, so they can type straight away.
   */
  function focusAddressField(field: AddressField) {
    const el = document.getElementById(`co-${field}`);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }

  /** Everything an input needs to be tied to its label and its error. */
  function addressFieldProps(field: AddressField) {
    const error = addressErrors[field];
    return {
      id: `co-${field}`,
      "aria-invalid": error ? true : undefined,
      "aria-describedby": error?.message ? `co-${field}-error` : undefined,
    };
  }

  async function handleSubmitAddress(e: React.FormEvent) {
    e.preventDefault();
    await submitAddress();
  }

  async function submitAddress() {
    if (!cart?.items.length) return;

    const sent = visibleForm(form, ask);
    setAddressAttempted(true);
    const problems = orderedErrors(validateAddress(sent, { companyAllowed: ask.companyName }, t.shop));
    if (problems.length) {
      focusAddressField(problems[0].field);
      return;
    }

    setSubmitting(true);
    setFormError("");

    const res = await fetch("/next-api/public/shop/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartToken: token,
        email: form.email.trim() || null,
        name: form.name.trim() || null,
        companyName: sent.companyName || null,
        phone: sent.phone.trim() || null,
        // Consent is only meaningful with a number to text.
        smsOptIn: Boolean(sent.phone.trim()) && form.smsOptIn,
        line1: form.line1,
        line2: sent.line2 || null,
        city: form.city,
        zip: form.zip,
        country: form.country,
        couponCode: form.couponCode || null,
        // Stored on the order as customerLocale, and it is what the backend
        // translates the shipping methods (and later the order emails and
        // documents) into. Left out, the DTO defaults it to "fr", so every
        // visitor was quoted French method names whatever language they were
        // browsing in.
        locale,
        ...getMetaCookies(),
        ...getTikTokCookies(),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      // A phone-only checkout with verification switched on: open the code
      // step instead of an error. Confirming it calls submitAddress again.
      if (err?.code === "PHONE_VERIFICATION_REQUIRED") {
        setVerifyFor({ phone: sent.phone.trim(), country: form.country });
        setSubmitting(false);
        return;
      }
      const msg = typeof err?.message === "string" ? err.message : t.shop.checkoutStartError;
      setFormError(msg);
      setSubmitting(false);
      return;
    }

    const snap: CheckoutSnapshot = await res.json();
    // Quoted with the locale just posted — see the re-quote effect above.
    quotedLocale.current = locale;
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
   * Sends only the carrier's point id — the server re-reads every field from
   * the carrier before storing it, so nothing the browser rendered is trusted
   * on the way back in.
   */
  async function applyPickupPoint(pickupPointId: string) {
    if (!snapshot || !pickupPointId) return;
    setShippingUpdating(true);
    setFormError("");
    try {
      const res = await fetch(`/next-api/public/shop/checkout/${snapshot.orderId}/pickup-point`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupPointId }),
      });
      if (!res.ok) {
        setFormError(t.shop.pickupError);
        return;
      }
      setSnapshot((await res.json()) as CheckoutSnapshot);
    } catch {
      setFormError(t.shop.pickupError);
    } finally {
      setShippingUpdating(false);
    }
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
    if (needsPickupPoint && !pickupPoint) {
      setFormError(t.shop.pickupRequired);
      return;
    }
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

    const { clientSecret: cs, reservationExpiresAt, metaAddPaymentInfoEventId, tiktokAddPaymentInfoEventId } = await intentRes.json();
    setClientSecret(cs);
    syncReservation(reservationExpiresAt);

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
          <Link href={`/${locale}`} className={styles.emptyCta}>
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
  const selectedMethod = shippingMethods.find((m) => m.id === selectedMethodId) ?? null;
  // The server decides whether a point is needed; the flag rides on the quote,
  // so re-quoting after an address change turns the selector off by itself.
  const needsPickupPoint = selectedMethod?.requiresPickupPoint === true;
  const pickupPoint = snapshot?.pickupPoint ?? null;

  const freeShippingUpgrades = snapshot?.freeShipping ? shippingMethods.filter((m) => !m.isFree) : [];
  const freeShippingMethod = snapshot?.freeShipping ? (shippingMethods.find((m) => m.isFree) ?? null) : null;

  return (
    <div className={styles.container}>
      <h1 className={styles.heading}>{t.shop.checkoutTitle}</h1>
      <StepIndicator current={step} onStepClick={handleStepClick} showPersonalise={personaliseInFlow || step === "personalise" || cart.items.some((i) => i.personalizable)} t={t} />

      <div className={styles.layout}>
        {/* ── Left: step form ── */}
        <div className={styles.formSection}>
          {/* STEP 0 — Personalise (optional). Every line that can carry
              embroidery: the plain ones with the offer, the ones already
              embroidered with their design, so a customer who personalises
              one of two caps sees where they stand. Leaving it is one click,
              and nothing here is required. */}
          {step === "personalise" && (
            <div>
              <h2 className={styles.sectionTitle}>{t.personalize.stepTitle}</h2>
              <p className={styles.personaliseIntro}>{t.personalize.stepIntro}</p>
              <div className={styles.personaliseList}>
                {cart.items
                  .filter((item) => item.personalizable)
                  .map((item) => (
                    <div key={item.id} className={styles.personaliseRow}>
                      <span className={styles.personaliseThumb}>
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" />
                        ) : null}
                      </span>
                      <div className={styles.personaliseBody}>
                        <p className={styles.personaliseTitle}>
                          {item.titleSnapshot}
                          {item.quantity > 1 && <span className={styles.personaliseQty}> ×{item.quantity}</span>}
                        </p>
                        {item.optionsSnapshot && item.optionsSnapshot.length > 0 && (
                          <p className={styles.personaliseOptions}>{item.optionsSnapshot.map((o) => o.displayValue ?? o.value).join(" · ")}</p>
                        )}
                        {item.personalizations?.length ? (
                          <>
                            <span className={styles.personaliseDone}>
                              <Check size={13} strokeWidth={3} aria-hidden="true" />
                              {t.personalize.stepDone}
                            </span>
                            {item.personalizations.map((d) => (
                              <EmbroideryLine key={d.placementKey} design={d} locale={locale} />
                            ))}
                            <PersonalisedLineActions item={item} locale={locale} from="checkout" />
                          </>
                        ) : (
                          <PersonaliseOffer item={item} locale={locale} from="checkout" />
                        )}
                      </div>
                    </div>
                  ))}
              </div>
              <StickyActionBar>
                <button type="button" className={styles.continueBtn} onClick={() => goToStep("address")}>
                  {t.personalize.stepContinue}
                </button>
              </StickyActionBar>
            </div>
          )}

          {/* STEP 1 — Address */}
          {step === "address" && (
            // noValidate: the browser's bubbles show one field at a time, in
            // the browser's language, and skipped the name fields — see
            // addressValidation.ts. `required` stays on the inputs for what it
            // tells assistive tech.
            <form onSubmit={handleSubmitAddress} noValidate>
              <h2 className={styles.sectionTitle}>{t.shop.contactInfo}</h2>
              <div className={`${styles.field} ${addressErrors.name ? styles.fieldInvalid : ""}`}>
                <label htmlFor="co-name">
                  {t.shop.fullName}
                  <span className={styles.requiredMark}> *</span>
                </label>
                <input
                  {...addressFieldProps("name")}
                  autoComplete="name"
                  autoCapitalize="words"
                  required={!ask.companyName}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <FieldError id="co-name-error" message={addressErrors.name?.message} />
              </div>
              {ask.companyName && (
                <div className={styles.field}>
                  <label htmlFor="co-companyName">{t.shop.companyNameOptional}</label>
                  <input
                    id="co-companyName"
                    autoComplete="organization"
                    value={form.companyName}
                    onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                  />
                </div>
              )}
              <p className={styles.requiredNote}>{ask.companyName ? t.shop.requiredNote : t.shop.requiredNoteNameOnly}</p>
              {/* Email OR phone: some customers have no email address at all.
                  Neither is marked required on its own; the note says the rule. */}
              <div className={styles.row}>
                <div className={`${styles.field} ${addressErrors.email ? styles.fieldInvalid : ""}`}>
                  <label htmlFor="co-email">{t.shop.emailLabel}</label>
                  <input
                    {...addressFieldProps("email")}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                  <FieldError id="co-email-error" message={addressErrors.email?.message} />
                </div>
                <div className={`${styles.field} ${addressErrors.phone ? styles.fieldInvalid : ""}`}>
                  <label htmlFor="co-phone">{t.shop.phoneLabel}</label>
                  <input
                    {...addressFieldProps("phone")}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    // Shows the international shape. A number typed without the
                    // code still works: the server adds the shipping country's.
                    placeholder="+33 6 12 34 56 78"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  />
                  <FieldError id="co-phone-error" message={addressErrors.phone?.message} />
                </div>
              </div>
              <p className={styles.requiredNote}>{t.shop.contactEitherNote}</p>

              <h2 className={styles.sectionTitle}>{t.shop.shippingAddressTitle}</h2>
              <div className={`${styles.field} ${addressErrors.country ? styles.fieldInvalid : ""}`}>
                <label htmlFor="co-country">
                  {t.shop.countryLabel}
                  <span className={styles.requiredMark}> *</span>
                </label>
                <CountrySelect
                  id="co-country"
                  countries={countries}
                  value={form.country}
                  onChange={(isoCode) => setForm((f) => ({ ...f, country: isoCode }))}
                  disabled={countriesLoading}
                  required
                  invalid={!!addressErrors.country}
                  describedBy={addressErrors.country ? "co-country-error" : undefined}
                  placeholder={countriesLoading ? t.shop.loading : t.shop.selectCountryPlaceholder}
                  searchPlaceholder={t.shop.countrySearchPlaceholder}
                  noResultsLabel={t.shop.countryNoResults}
                  ariaLabel={t.shop.countryLabel}
                />
                <FieldError id="co-country-error" message={addressErrors.country?.message} />
                {/* Said at the first field it applies to, so a visitor outside
                    the EU finds out before typing a whole address. */}
                <p className={styles.countryNote}>{t.shop.shipsWithinEu}</p>
              </div>
              <div className={`${styles.field} ${addressErrors.line1 ? styles.fieldInvalid : ""}`}>
                <label htmlFor="co-line1">
                  {/* "Line 1" only when a line 2 follows it. */}
                  {ask.addressLine2 ? t.shop.addressLine1 : t.shop.addressLabel}
                  <span className={styles.requiredMark}> *</span>
                </label>
                <input {...addressFieldProps("line1")} autoComplete="address-line1" required value={form.line1} onChange={(e) => setForm((f) => ({ ...f, line1: e.target.value }))} />
                <FieldError id="co-line1-error" message={addressErrors.line1?.message} />
              </div>
              {ask.addressLine2 && (
                <div className={styles.field}>
                  <label htmlFor="co-line2">{t.shop.addressLine2}</label>
                  <input id="co-line2" autoComplete="address-line2" value={form.line2} onChange={(e) => setForm((f) => ({ ...f, line2: e.target.value }))} />
                </div>
              )}
              <div className={styles.row}>
                <div className={`${styles.field} ${addressErrors.city ? styles.fieldInvalid : ""}`}>
                  <label htmlFor="co-city">
                    {t.shop.cityLabel}
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input {...addressFieldProps("city")} autoComplete="address-level2" required value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
                  <FieldError id="co-city-error" message={addressErrors.city?.message} />
                </div>
                <div className={`${styles.field} ${addressErrors.zip ? styles.fieldInvalid : ""}`}>
                  <label htmlFor="co-zip">
                    {t.shop.zipLabel}
                    <span className={styles.requiredMark}> *</span>
                  </label>
                  <input {...addressFieldProps("zip")} autoComplete="postal-code" required value={form.zip} onChange={(e) => setForm((f) => ({ ...f, zip: e.target.value }))} />
                  <FieldError id="co-zip-error" message={addressErrors.zip?.message} />
                </div>
              </div>

              {/* Every problem at once, in screen order, each one a way back to
                  its field — the customer pressed the button at the bottom of
                  the form, and on a phone the first problem may be a long
                  scroll above it. Polite, not assertive: focus has already
                  moved to the first field, which announces its own error. */}
              {addressProblems.some((p) => p.message) && (
                <div className={styles.errorSummary} aria-live="polite">
                  <p className={styles.errorSummaryTitle}>
                    <AlertCircle size={16} aria-hidden="true" />
                    {t.shop.addrErrSummary}
                  </p>
                  <ul className={styles.errorSummaryList}>
                    {addressProblems
                      .filter((p) => p.message)
                      .map((p) => (
                        <li key={p.field}>
                          <button type="button" className={styles.errorSummaryLink} onClick={() => focusAddressField(p.field)}>
                            {p.message}
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              {verifyFor && token && verifyFor.phone === form.phone.trim() && verifyFor.country === form.country && !form.email.trim() && (
                <PhoneVerificationPanel
                  key={`${verifyFor.country}:${verifyFor.phone}`}
                  cartToken={token}
                  phone={verifyFor.phone}
                  country={verifyFor.country}
                  locale={locale}
                  t={t}
                  onVerified={() => {
                    setVerifyFor(null);
                    void submitAddress();
                  }}
                />
              )}

              {formError && (
                <p className={styles.error} role="alert">
                  {formError}
                </p>
              )}
              {/* SMS marketing consent: unticked, shown once there is a number
                  to text, and the last thing before the button so it reads as
                  an extra, not part of the contact details. */}
              {form.phone.trim() && (
                <label className={styles.consentRow}>
                  <input type="checkbox" checked={!!form.smsOptIn} onChange={(e) => setForm((f) => ({ ...f, smsOptIn: e.target.checked }))} />
                  <span>{t.shop.smsOptInLabel}</span>
                </label>
              )}
              <StickyActionBar>
                <button type="submit" disabled={submitting} className={styles.continueBtn}>
                  {submitting ? t.shop.processing : t.shop.continueToShipping}
                </button>
              </StickyActionBar>
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
                      <span className={styles.shippingName}>
                        {carrierLogo(up) && <Image src={carrierLogo(up)!} alt="" width={28} height={28} unoptimized className={styles.carrierLogo} />}
                        {up.name}
                      </span>
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
                      <span className={styles.shippingName}>
                        {carrierLogo(m) && <Image src={carrierLogo(m)!} alt="" width={28} height={28} unoptimized className={styles.carrierLogo} />}
                        {m.name}
                      </span>
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

              {needsPickupPoint && snapshot && (
                <div style={{ marginTop: "0.9rem" }}>
                  <PickupPointSelector
                    orderId={snapshot.orderId}
                    selected={pickupPoint}
                    defaultPostcode={form.zip}
                    defaultCity={form.city}
                    onSelect={applyPickupPoint}
                    labels={{
                      title: t.shop.pickupTitle,
                      intro: t.shop.pickupIntro,
                      searchLabel: t.shop.pickupSearchLabel,
                      searchPlaceholder: t.shop.pickupSearchPlaceholder,
                      noResults: t.shop.pickupNoResults,
                      error: t.shop.pickupError,
                      selected: t.shop.pickupSelected,
                      change: t.shop.pickupChange,
                      choose: t.shop.pickupChoose,
                      openingHours: t.shop.pickupOpeningHours,
                      closed: t.shop.pickupClosed,
                      relay: t.shop.pickupRelay,
                      locker: t.shop.pickupLocker,
                      suggestionsAria: t.shop.pickupSuggestionsAria,
                      resultsAria: t.shop.pickupResultsAria,
                      typeMore: t.shop.pickupTypeMore,
                      clear: t.shop.pickupClear,
                      mapAria: t.shop.pickupMapAria,
                      nearLabel: t.shop.pickupNear,
                      notOnMap: t.shop.pickupNotOnMap,
                      weekdays: t.shop.pickupWeekdays,
                    }}
                  />
                </div>
              )}

              <StickyActionBar>
                <div className={styles.actionRow}>
                  <button type="button" onClick={() => handleStepClick("address")} className={styles.backBtn}>
                    {t.shop.back}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || shippingUpdating || !selectedMethodId || (needsPickupPoint && !pickupPoint)}
                    className={styles.continueBtn}
                    style={{ flex: 1 }}
                  >
                    {submitting ? t.shop.processing : t.shop.continueToPayment}
                  </button>
                </div>
              </StickyActionBar>
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
                <Elements key={locale} stripe={stripePromise} options={{ clientSecret, locale: STRIPE_LOCALE[locale], appearance: { theme: "stripe" } }}>
                  <StripePaymentForm orderId={snapshot.orderId} orderNumber={snapshot.orderNumber} total={snapshot.totalCents} trackingToken={snapshot.trackingToken} form={visibleForm(form, ask)} locale={locale} t={t} notice={paymentNotice || undefined} />
                </Elements>
              )}
            </div>
          )}
        </div>

        {/* ── Right: order summary ── */}
        <div className={styles.summary}>
          <h3>{t.shop.checkoutOrderSummary}</h3>

          <div className={styles.lineItems}>
            {cart.items.map((item) => {
              const productHref = item.productSlug ? `/${locale}/shop/${item.productSlug}` : null;
              // Thumbnail and name make up one navigation target; the price sits
              // outside it since it isn't something you click through on.
              const body = (
                <>
                  <span className={styles.summaryItemThumb}>
                    <span className={styles.summaryItemImage}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt="" />
                      ) : (
                        <span className={styles.summaryItemImagePlaceholder} />
                      )}
                    </span>
                    {item.quantity > 1 && <span className={styles.summaryItemQtyBadge}>×{item.quantity}</span>}
                  </span>
                  <span className={styles.summaryItemName}>
                    <span className={styles.summaryItemTitle}>
                      {item.titleSnapshot}
                      {productHref && <ArrowUpRight size={13} strokeWidth={2.25} className={styles.summaryItemGoIcon} aria-hidden="true" />}
                    </span>
                    {item.optionsSnapshot && item.optionsSnapshot.length > 0 && (
                      <span className={styles.summaryItemOptions}>{item.optionsSnapshot.map((o) => `${o.attributeName}: ${o.displayValue ?? o.value}`).join(" · ")}</span>
                    )}
                    {/* The embroidery, verbatim. This is the last screen before
                        payment, and a personalised item cannot be returned, so
                        the spelling has to be visible here and not only in the
                        cart drawer the customer may never have opened. */}
                    {item.personalizations?.map((d) => (
                      <EmbroideryLine key={d.placementKey} design={d} locale={locale} compact />
                    ))}
                    {/* The line price beside this includes it; said here so the
                        customer can see what the personalisation adds. */}
                    {!!item.personalizations?.length && (
                      <span className={styles.summaryItemFee}>{t.personalize.feeIncluded.replace("{price}", `€${centsToEuros(embroideryCentsOf([item]))}`)}</span>
                    )}
                  </span>
                </>
              );
              return (
                <div key={item.id} className={styles.summaryItem}>
                  {productHref ? (
                    // New tab on purpose: checking the product page must never cost
                    // the customer the details they've already filled in here.
                    <Link href={productHref} target="_blank" rel="noopener noreferrer" className={styles.summaryItemLink}>
                      {body}
                    </Link>
                  ) : (
                    <span className={styles.summaryItemLink}>{body}</span>
                  )}
                  <span className={styles.summaryItemPrice}>€{centsToEuros(item.lineTotalCents)}</span>
                </div>
              );
            })}
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
              embroideryCents={embroideryCentsOf(cart.items)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
