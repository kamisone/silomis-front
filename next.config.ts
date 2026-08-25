import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    API_BASE_URL_BROWSER:  process.env.API_BASE_URL_BROWSER  ?? "http://localhost:4000",
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "storage.googleapis.com", port: "", pathname: "/**", search: "" }],
  },
};

export default nextConfig;
