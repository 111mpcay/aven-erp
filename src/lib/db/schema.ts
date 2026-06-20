import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

/**
 * Phase 0 schema: the tenancy spine — companies, profiles, company_members.
 *
 * RLS is the DB half of the two-layer auth model (RBAC in Server Actions is the
 * other). Adding any pgPolicy auto-enables RLS on the table. Policies here are
 * deliberately NON-RECURSIVE (no policy on company_members queries
 * company_members) so Postgres can't hit "infinite recursion in policy".
 * Broader member-management policies arrive with the Phase 5 RBAC matrix.
 *
 * NOTE: RLS only enforces when queries run as the `authenticated` role. The
 * runtime client connects as `postgres`; the `.rls()` wrapper (lib/db/rls.ts)
 * downgrades the role + injects JWT claims per transaction. Never query the
 * rls client directly.
 */

export const companyRole = pgEnum("company_role", [
  "owner",
  "admin",
  "accountant",
  "encoder",
  "viewer",
]);

// companies — one row per legal entity (Vault Master, Smart Haven, Saglit Resorts)
export const companies = pgTable(
  "companies",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    baseCurrency: text("base_currency").notNull().default("PHP"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // A user can read companies they belong to (subquery hits company_members,
    // not companies — no recursion).
    pgPolicy("companies_select_members", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.id} in (select company_id from company_members where user_id = ${authUid})`,
    }),
    // Only owners/admins may write. Bootstrap/seed runs via the secret key
    // (service_role), which bypasses RLS entirely.
    pgPolicy("companies_modify_admins", {
      for: "all",
      to: authenticatedRole,
      using: sql`${t.id} in (select company_id from company_members where user_id = ${authUid} and role in ('owner','admin'))`,
      withCheck: sql`${t.id} in (select company_id from company_members where user_id = ${authUid} and role in ('owner','admin'))`,
    }),
  ],
);

// profiles — 1:1 with auth.users; holds display name + (Phase 5) action PIN hash
export const profiles = pgTable(
  "profiles",
  {
    id: uuid().primaryKey(), // == auth.users.id
    fullName: text("full_name"),
    actionPinHash: text("action_pin_hash"), // nullable until Phase 5 (PIN gating)
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("profiles_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
    }),
    pgPolicy("profiles_update_self", {
      for: "update",
      to: authenticatedRole,
      using: sql`${t.id} = ${authUid}`,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
    pgPolicy("profiles_insert_self", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${t.id} = ${authUid}`,
    }),
  ],
);

// company_members — per-company role; this join drives the switcher AND every RLS check
export const companyMembers = pgTable(
  "company_members",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: companyRole().notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.companyId, t.userId] }),
    // Phase 0: a user sees only their OWN membership rows. Non-recursive
    // (predicate is on the row itself, no subquery into company_members).
    pgPolicy("company_members_select_self", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
  ],
);
