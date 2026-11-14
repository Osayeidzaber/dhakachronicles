import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, hasCurrentSession, legacySessionCookies, withLegacySession } from "@/lib/supabase/session-cookie";

/**
 * Runs on the server before matching routes:
 *  - "/" redirects to the default language
 *  - refreshes the session cookie (httpOnly) for staff routes
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
    url.pathname = `/${process.env.DEFAULT_LANGUAGE === "bn" ? "bn" : "en"}`;
    return NextResponse.redirect(url);
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.next({ request });

  // Sessions started before the cookie was renamed are read under the new name (so nobody is
  // signed out); on the next page load the old, provider-named cookie is replaced. See below.
  const legacy = legacySessionCookies(request.cookies.getAll());
  const carryOver = legacy.length > 0 && !hasCurrentSession(request.cookies.getAll());

  let response = NextResponse.next({ request });
  let refreshed = false;
  const secure = process.env.NODE_ENV === "production";
  const supabase = createServerClient(url, key, {
    cookieOptions: { name: SESSION_COOKIE },
    cookies: {
      getAll: () => withLegacySession(request.cookies.getAll()),
      setAll: (list) => {
        refreshed = true;
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) {
          response.cookies.set(name, value, { ...options, httpOnly: true, sameSite: "lax", secure });
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  if ((path.startsWith("/admin") || path === "/welcome" || path === "/set-password") && !data.user) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(login);
  }
  // Only on page loads: a form post (for example signing out) sets its own cookies and must not race this.
  if (request.method === "GET" || request.method === "HEAD") {
    for (const c of legacy) {
      // A refresh during this request already wrote fresh cookies under the new name.
      if (carryOver && !refreshed) response.cookies.set(c.to, c.value, { path: "/", httpOnly: true, sameSite: "lax", secure, maxAge: SESSION_MAX_AGE });
      response.cookies.set(c.from, "", { path: "/", maxAge: 0 });
    }
  }
  return response;
}

export const config = {
  matcher: ["/", "/privacy", "/admin/:path*", "/login", "/welcome", "/set-password", "/auth/:path*", "/api/media/:path*", "/api/instagram/:path*"],
};
