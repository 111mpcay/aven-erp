import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  date,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
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

/* ------------------------------------------------------------------ *
 * Phase 1: money accounts, categories, expenses, audit log.
 *
 * RLS helpers below all subquery into company_members (the tenancy
 * spine), never into the table being protected — so they stay
 * non-recursive, exactly like the Phase 0 `companies` policies. The
 * write-role set excludes `viewer`, so viewers are read-only at the DB
 * layer too; Server Actions (requireRole) are the matching app layer.
 * ------------------------------------------------------------------ */

// Rows whose company the current user belongs to (any role) — read scope.
const memberCompany = (companyId: AnyPgColumn) =>
  sql`${companyId} in (select company_id from company_members where user_id = ${authUid})`;

// Rows whose company the user belongs to with a write role — write scope.
// Role list inlined as literals (not bound params) so it serializes correctly
// into the static migration SQL; the set mirrors WRITE_ROLES in lib/auth.
const writeRoleCompany = (companyId: AnyPgColumn) =>
  sql`${companyId} in (select company_id from company_members where user_id = ${authUid} and role in ('owner','admin','accountant','encoder'))`;

// Rows whose company the user owns/admins — privileged scope.
const adminCompany = (companyId: AnyPgColumn) =>
  sql`${companyId} in (select company_id from company_members where user_id = ${authUid} and role in ('owner','admin'))`;

export const cashAccountType = pgEnum("cash_account_type", [
  "bank",
  "ewallet",
  "cash",
]);

export const categoryKind = pgEnum("category_kind", [
  "income",
  "cogs",
  "expense",
]);

export const expenseSource = pgEnum("expense_source", [
  "manual",
  "meta_ads",
  "import",
  "recurring",
]);

export const expenseStatus = pgEnum("expense_status", ["draft", "approved"]);

// cash_accounts — where money sits (BPI, GCash, Maya, Cash on Hand, …)
export const cashAccounts = pgTable(
  "cash_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: cashAccountType().notNull(),
    openingBalance: numeric("opening_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    currency: text().notNull().default("PHP"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("cash_accounts_company_idx").on(t.companyId),
    // Natural key for idempotent seeding + no duplicate account names per company.
    unique("cash_accounts_company_name_uq").on(t.companyId, t.name),
    pgPolicy("cash_accounts_select_members", {
      for: "select",
      to: authenticatedRole,
      using: memberCompany(t.companyId),
    }),
    pgPolicy("cash_accounts_write_roles", {
      for: "all",
      to: authenticatedRole,
      using: writeRoleCompany(t.companyId),
      withCheck: writeRoleCompany(t.companyId),
    }),
  ],
);

// categories — chart-of-accounts-lite; parent_id gives an optional hierarchy
export const categories = pgTable(
  "categories",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: text().notNull(),
    kind: categoryKind().notNull(),
    code: text(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("categories_company_idx").on(t.companyId),
    // Natural key for idempotent seeding by stable code. code is nullable, and
    // Postgres treats NULLs as distinct, so user-created categories without a
    // code are unconstrained; only seeded (coded) rows dedupe.
    unique("categories_company_code_uq").on(t.companyId, t.code),
    pgPolicy("categories_select_members", {
      for: "select",
      to: authenticatedRole,
      using: memberCompany(t.companyId),
    }),
    pgPolicy("categories_write_roles", {
      for: "all",
      to: authenticatedRole,
      using: writeRoleCompany(t.companyId),
      withCheck: writeRoleCompany(t.companyId),
    }),
  ],
);

// expenses — the first outflow stream. ALL inserts go through lib/ledger →
// createExpense(); never insert directly (CLAUDE.md). source/source_ref let
// Meta Ads / import / recurring feed the same table later with no schema change.
export const expenses = pgTable(
  "expenses",
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    expenseDate: date("expense_date").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "restrict",
    }),
    cashAccountId: uuid("cash_account_id").references(() => cashAccounts.id, {
      onDelete: "restrict",
    }),
    vendor: text(),
    description: text(),
    amount: numeric({ precision: 14, scale: 2 }).notNull(),
    currency: text().notNull().default("PHP"),
    fxToPhp: numeric("fx_to_php", { precision: 18, scale: 6 })
      .notNull()
      .default("1"),
    source: expenseSource().notNull().default("manual"),
    sourceRef: text("source_ref"),
    receiptPath: text("receipt_path"),
    status: expenseStatus().notNull().default("approved"),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // $onUpdate bumps this in JS on every Drizzle update — no DB trigger, so it
    // needs no migration change.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("expenses_company_date_idx").on(t.companyId, t.expenseDate),
    index("expenses_company_category_idx").on(t.companyId, t.categoryId),
    pgPolicy("expenses_select_members", {
      for: "select",
      to: authenticatedRole,
      using: memberCompany(t.companyId),
    }),
    pgPolicy("expenses_write_roles", {
      for: "all",
      to: authenticatedRole,
      using: writeRoleCompany(t.companyId),
      withCheck: writeRoleCompany(t.companyId),
    }),
  ],
);

// audit_log — append-only trail. Written in the SAME rls() tx as each mutation
// via withAudit() so a rolled-back mutation leaves no audit row. No update/
// delete policy ⇒ immutable by construction. SELECT limited to owner/admin
// (the Phase 5 audit viewer reads it).
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid().primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    action: text().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    changes: jsonb(),
    ip: text(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_company_idx").on(t.companyId, t.createdAt),
    pgPolicy("audit_log_select_admins", {
      for: "select",
      to: authenticatedRole,
      using: adminCompany(t.companyId),
    }),
    pgPolicy("audit_log_insert_members", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${memberCompany(t.companyId)} and ${t.actorId} = ${authUid}`,
    }),
  ],
);
