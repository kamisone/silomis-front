import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with a self-contained server.js and only the
  // node_modules actually reached by the build. The container image drops from
  // a full node:20 + the entire dependency tree to a slim runtime, which is
  // what makes an HPA scale-up useful: a pod that takes 40s to pull and boot
  // is still starting when the traffic spike that triggered it has passed.
  output: "standalone",

  env: {
    API_BASE_URL_BROWSER:  process.env.API_BASE_URL_BROWSER  ?? "http://localhost:4000",
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "storage.googleapis.com", port: "", pathname: "/**", search: "" }],
  },
};

export default nextConfig;
