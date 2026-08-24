import { Suspense } from "react";
import SearchResults from "./SearchResults";

export const metadata = {
  title: "Search — Silomis",
  description: "Search products at Silomis.",
};

export default function ShopSearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
