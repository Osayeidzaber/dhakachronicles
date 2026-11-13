import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on the server before matching routes:
 *  - "/" redirects to the default language
 *  - refreshes the Supabase session cookie (httpOnly) for staff routes
 *  - redirects signed-out users away from /admin
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/privacy") {
    // Stable URL for the Meta app's Privacy Policy field.
    const url = request.nextUrl.clone();
    url.pathname = "/en/privacy";
    return NextResponse.redirect(url, 308);
  }
  if (path === "/") {
    const url = request.nextUrl.clone();
    url.pathname = `/${process.env.DEFAULT_LANGUAGE === "en" ? "en" : "bn"}`;
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if ((path.startsWith("/admin") || path === "/welcome") && !data.user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: ["/", "/privacy", "/admin/:path*", "/login", "/welcome", "/api/media/:path*", "/api/instagram/:path*"],
};
