import "server-only";

import { and, eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getDb } from "@/lib/db/rls";
import { companies, companyMembers } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export const ROLES = [
  "owner",
  "admin",
  "accountant",
  "encoder",
  "viewer",
] as const;
export type Role = (typeof ROLES)[number];

export const ACTIVE_COMPANY_COOKIE = "active_company";

/** Verified current user (JWT validated by getClaims), or null. */
export async function getAuthUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims as { sub?: string; email?: string } | undefined;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? null };
}

export async function requireAuth() {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return user;
}

export type MyCompany = { id: string; name: string; slug: string; role: Role };

/** Companies the current user belongs to (drives the company switcher). */
export async function getMyCompanies(): Promise<MyCompany[]> {
  const user = await getAuthUser();
  if (!user) return [];
  const db = await getDb();
  return db.rls((tx) =>
    tx
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        role: companyMembers.role,
      })
      .from(companyMembers)
      .innerJoin(companies, eq(companies.id, companyMembers.companyId))
      .where(eq(companyMembers.userId, user.id))
      .orderBy(companies.name),
  );
}

export async function getActiveCompanyId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
}

/**
 * RBAC gate — the app-layer half of two-layer auth. Call at the top of every
 * sensitive Server Action: it verifies the user has an allowed role in the
 * active company. RLS independently enforces the same boundary at the database,
 * so a missed check here still can't leak another company's data.
 */
export async function requireRole(allowed: Role[]) {
  const user = await requireAuth();
  const companyId = await getActiveCompanyId();
  if (!companyId) redirect("/dashboard");

  const db = await getDb();
  const rows = await db.rls((tx) =>
    tx
      .select()
      .from(companyMembers)
      .where(
        and(
          eq(companyMembers.userId, user.id),
          eq(companyMembers.companyId, companyId),
        ),
      ),
  );

  const membership = rows[0];
  if (!membership || !allowed.includes(membership.role as Role)) {
    throw new Error("Forbidden: insufficient role for this action.");
  }
  return { userId: user.id, companyId, role: membership.role as Role };
}
