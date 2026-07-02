"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  ACTIVE_COMPANY_COOKIE,
  getMyCompanies,
  requireAuth,
} from "@/lib/auth/rbac";
import { clearPinToken } from "@/lib/auth/pin";
import { createClient } from "@/lib/supabase/server";

const CompanyIdSchema = z.string().uuid();

/**
 * Persist the active company in an httpOnly cookie. Validates the caller is
 * authenticated AND a member of the target company before writing — the cookie
 * sets tenant context, so the mutation guards its own input (RLS is the backstop).
 */
export async function setActiveCompany(companyId: string) {
  await requireAuth();

  const parsed = CompanyIdSchema.safeParse(companyId);
  if (!parsed.success) throw new Error("Invalid company id.");

  const list = await getMyCompanies();
  if (!list.some((c) => c.id === parsed.data)) {
    throw new Error("Forbidden: you are not a member of that company.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, parsed.data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_COMPANY_COOKIE); // don't leak scoping into next session
  await clearPinToken(); // don't let PIN elevation survive into the next session

  revalidatePath("/", "layout");
  redirect("/login");
}
