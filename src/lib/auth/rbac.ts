import "server-only";

import { eq } from "drizzle-orm";
import { cookies, headers } from "next/headers";
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

/** Raw value of the active-company cookie (may be absent or stale). */
export async function getActiveCompanyId() {
  const cookieStore = await cookies();
  return cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value ?? null;
}

/**
 * Resolved active company (+ the full membership list) for page reads. Mirrors
 * the layout's resolution so pages, the switcher, and requireRole() all agree.
 */
export async function getActiveCompany() {
  const [companies, cookieId] = await Promise.all([
    getMyCompanies(),
    getActiveCompanyId(),
  ]);
  return { companies, active: resolveActiveCompany(companies, cookieId) };
}

/**
 * The cookie is an OPTIONAL override, not the source of truth: resolve to the
 * cookie's company only if the user is actually a member, otherwise fall back
 * to their first company. This keeps the switcher UI, the cookie, and
 * requireRole() in agreement, and makes a missing/stale cookie degrade
 * gracefully instead of hard-failing.
 */
export function resolveActiveCompany<T extends { id: string }>(
  list: T[],
  cookieId: string | null,
): T | null {
  return list.find((c) => c.id === cookieId) ?? list[0] ?? null;
}

/**
 * RBAC gate — the app-layer half of two-layer auth. Call at the top of every
 * sensitive Server Action: it verifies the user has an allowed role in the
 * (resolved) active company. RLS independently enforces the same boundary at
 * the database, so a missed check here still can't leak another company's data.
 */
export async function requireRole(allowed: Role[]) {
  const user = await requireAuth();
  const list = await getMyCompanies();
  const cookieId = await getActiveCompanyId();
  const active = resolveActiveCompany(list, cookieId);

  if (!active) redirect("/dashboard"); // user belongs to no company
  if (!allowed.includes(active.role)) {
    throw new Error("Forbidden: insufficient role for this action.");
  }
  return { userId: user.id, companyId: active.id, role: active.role };
}

/** Best-effort client IP for the audit trail (Vercel sets x-forwarded-for). */
export async function getClientIp() {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

/** Roles allowed to write expenses / categories / cash accounts (excludes viewer).
 *  Mirrors the DB write-role RLS policies in lib/db/schema.ts. */
export const WRITE_ROLES: Role[] = ["owner", "admin", "accountant", "encoder"];
