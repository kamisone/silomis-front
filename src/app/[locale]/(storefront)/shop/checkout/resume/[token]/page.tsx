"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTranslations } from "@/lib/i18n";
import { useLocale } from "@/lib/i18n/useLocale";
import styles from "./Resume.module.css";

interface CheckoutSession {
  cartToken: string;
  orderId: string | null;
  step: "address" | "shipping" | "payment" | "complete";
  formSnapshot: Record<string, string> | null;
}

const EMPTY_FORM = {
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
};

function persistKey(cartToken: string) {
  return `checkout:${cartToken}`;
}

export default function ResumeCheckoutPage() {
  const locale = useLocale();
  const t = getTranslations(locale);
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const res = await fetch(`/next-api/public/shop/checkout/resume/${token}`);
      if (!res.ok) {
        if (!cancelled) setStatus("error");
        return;
      }
      const session: CheckoutSession = await res.json();

      // Switch the browser to this session's cart before the checkout page
      // mounts, so CartContext loads the right cart on the hard navigation below.
      try {
        localStorage.setItem("shop_cart_token", session.cartToken);
      } catch {
        // ignore
      }

      let snapshot = null;
      let step: "address" | "shipping" | "payment" = "address";
      if (session.orderId) {
        try {
          const snapRes = await fetch(`/next-api/public/shop/checkout/${session.orderId}`);
          if (snapRes.ok) {
            snapshot = await snapRes.json();
            if (session.step === "shipping" || session.step === "payment") step = session.step;
          }
        } catch {
          // fall through with no snapshot — restart at address
        }
      }

      const form = { ...EMPTY_FORM, ...(session.formSnapshot ?? {}) };

      try {
        sessionStorage.setItem(
          persistKey(session.cartToken),
          JSON.stringify({
            step,
            form,
            snapshot,
            selectedMethodId: snapshot?.shippingMethodId ?? null,
            clientSecret: null,
          }),
        );
      } catch {
        // ignore
      }

      // Full navigation (not client-side routing) so CartProvider remounts
      // and re-reads the cart token we just wrote to localStorage.
      window.location.href = `/${locale}/shop/checkout`;
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [token, locale]);

  if (status === "error") {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t.shop.checkoutLinkExpiredTitle}</h1>
          <p className={styles.subtitle}>{t.shop.checkoutLinkExpiredSub}</p>
          <Link href={`/${locale}/shop/cart`} className={styles.link}>
            {t.shop.goToCart}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <p className={styles.subtitle}>{t.shop.resumingCheckout}</p>
      </div>
    </div>
  );
}
