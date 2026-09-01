import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

/**
 * Web app manifest, served at /manifest.webmanifest and linked automatically.
 *
 * `start_url` is the bare root rather than a locale: the middleware picks the
 * locale from the visitor's own preferences, so hard-coding one here would pin
 * every installed copy to English.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — sandals, slippers and flip-flops`,
    short_name: SITE_NAME,
    description: "Comfortable sandals, slippers and flip-flops for indoors, the beach and everywhere in between.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Separate art with a wide safe margin: a launcher crops maskable icons
      // to its own shape, and the "any" versions above would lose their edges.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
