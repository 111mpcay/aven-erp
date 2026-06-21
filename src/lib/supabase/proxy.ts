import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase session on every request and gates access.
 * Called from src/proxy.ts (Next 16's renamed middleware).
 *
 * Footguns honored:
 *  - Do NOT run code between createServerClient() and getClaims() (random logout).
 *  - Return the SAME response object whose cookies the client wrote (copied onto
 *    redirects), or refreshed auth cookies are lost.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Must be immediately after createServerClient — nothing in between.
  const { data } = await supabase.auth.getClaims();
  const isAuthed = Boolean(data?.claims?.sub);

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname.startsWith("/auth/");
  const isAppRoute = !isAuthRoute && pathname !== "/";

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    const res = NextResponse.redirect(url);
    // preserve any refreshed auth cookies
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!isAuthed && isAppRoute) return redirectTo("/login");
  if (isAuthed && isAuthRoute) return redirectTo("/dashboard");

  return supabaseResponse;
}
