import type { Metadata } from "next";
import "../globals.css";

// Staff pages are always per-request (auth cookies); never prerendered or cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "CMS", template: "%s · Dhaka Chronicles CMS" },
  robots: { index: false, follow: false },
};

/** Root layout for staff-only pages (admin dashboard and login). */
export default function CmsRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
