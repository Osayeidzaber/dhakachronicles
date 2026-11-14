import type { NextConfig } from "next";

function mediaHosts() {
  const hosts = new Set(["media.dhakachronicles.com"]);
  try {
    if (process.env.R2_PUBLIC_BASE_URL) hosts.add(new URL(process.env.R2_PUBLIC_BASE_URL).hostname);
  } catch {
    /* invalid URL: keep the default */
  }
  return [...hosts].map((hostname) => ({ protocol: "https" as const, hostname }));
}

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: the app uses the ISR model
  // (route `revalidate` + revalidatePath on publish). See DECISIONS.md (D-008).
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["sharp"],
  // Media lives on R2 behind its public domain (R2_PUBLIC_BASE_URL); allow it for next/image.
  images: {
    remotePatterns: mediaHosts(),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/(admin|login)(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
