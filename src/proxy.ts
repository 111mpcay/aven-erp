import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

// Next 16: this file replaces middleware.ts; the export is named `proxy`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on all routes EXCEPT static assets / images, so auth gating never
  // blocks CSS/JS/images. Auth callback routes stay matched (handled in proxy).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
