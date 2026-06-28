import { NextResponse, type NextRequest } from "next/server";

import { getAuthUser } from "@/lib/auth/rbac";
import { getReceiptSignedUrl } from "@/lib/storage/receipts";

/**
 * GET /expenses/receipt?path=<storage-path>
 *
 * Stable href for "open receipt in a new tab": mints a short-lived signed URL
 * and redirects to it. Access is enforced by Storage RLS (the signed URL is
 * created with the user's session client), so a path for another company yields
 * no URL → 404. Never returns the object bytes directly.
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const path = request.nextUrl.searchParams.get("path");
  if (!path) {
    return new NextResponse("Missing path", { status: 400 });
  }

  const signedUrl = await getReceiptSignedUrl(path, 120);
  if (!signedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  return NextResponse.redirect(signedUrl);
}
