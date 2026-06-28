/**
 * Phase 0 tenancy bootstrap — the companies + owner membership the rest of the
 * system assumes. Idempotent. Run with:  npm run db:seed:tenancy
 *
 * Owner resolution: OWNER_EMAIL env var if set, otherwise the single existing
 * auth.users row (errors if there are 0 or >1 and OWNER_EMAIL is unset). The
 * owner must already exist in Supabase Auth (sign up first); this script only
 * creates the profile, companies, and owner memberships via the admin client.
 */
import { eq, inArray } from "drizzle-orm";

import { adminClient, adminDb } from "./db";
import { companies, companyMembers, profiles } from "../src/lib/db/schema";

const COMPANIES = [
  { name: "Vault Master", slug: "vault-master" },
  { name: "Smart Haven", slug: "smart-haven" },
  { name: "Saglit Resorts", slug: "saglit-resorts" },
];

async function resolveOwner() {
  const wanted = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const rows = wanted
    ? await adminClient`select id, email from auth.users where lower(email) = ${wanted}`
    : await adminClient`select id, email from auth.users order by created_at`;
  if (rows.length === 0) {
    throw new Error(
      wanted
        ? `No auth user with email ${wanted}. Sign up first.`
        : "No auth users found. Sign up the owner in Supabase Auth first.",
    );
  }
  if (!wanted && rows.length > 1) {
    throw new Error(
      `Multiple auth users found; set OWNER_EMAIL to pick the owner (${rows
        .map((r) => r.email)
        .join(", ")}).`,
    );
  }
  return { id: rows[0].id as string, email: rows[0].email as string };
}

async function main() {
  const owner = await resolveOwner();
  console.log(`Owner: ${owner.email} (${owner.id})`);

  // 1) profile (id == auth.users.id) — required by the company_members FK
  await adminDb
    .insert(profiles)
    .values({ id: owner.id })
    .onConflictDoNothing({ target: profiles.id });

  // 2) companies (idempotent by slug)
  await adminDb
    .insert(companies)
    .values(COMPANIES)
    .onConflictDoNothing({ target: companies.slug });

  // 3) owner memberships for every company
  const slugs = COMPANIES.map((c) => c.slug);
  const created = await adminDb
    .select({ id: companies.id, slug: companies.slug })
    .from(companies)
    .where(inArray(companies.slug, slugs));

  await adminDb
    .insert(companyMembers)
    .values(created.map((c) => ({ companyId: c.id, userId: owner.id, role: "owner" as const })))
    .onConflictDoNothing();

  // report
  const mems = await adminDb
    .select({ slug: companies.slug, role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(eq(companyMembers.userId, owner.id));
  console.log(
    `Companies: ${created.length}. Owner memberships: ${mems
      .map((m) => `${m.slug}:${m.role}`)
      .join(", ")}`,
  );
}

main()
  .then(async () => {
    await adminClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Tenancy seed failed:", err);
    await adminClient.end();
    process.exit(1);
  });
