import { Suspense } from "react";
import ShopListing from "./ShopListing";

export const metadata = {
  title: "Shop — Silomis",
  description: "Browse all products at Silomis.",
};

export default function ShopPage() {
  return (
    <Suspense fallback={null}>
      <ShopListing />
    </Suspense>
  );
}
