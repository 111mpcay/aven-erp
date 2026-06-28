# Phase 1 — Setup & DB bring-up

This phase adds the first **mutations** (expenses) plus their reference data
(cash accounts, categories), the audit trail, and receipt storage. The code is
self-contained, but three things must be done against a live Supabase project:
apply migrations, seed defaults, and create the receipts Storage bucket.

> ⚠️ **Heads-up (2026-06-28):** the project the app was pointed at
> (`tnnjbuqyfzfpnfyemewe.supabase.co`) **no longer resolves (NXDOMAIN)** — it
> has been deleted. Until a live database exists, migrations/seed/bucket cannot
> be applied and the app cannot run end to end. Follow the bring-up checklist
> below against a new (or existing) project.

---

## A. Point the app at a database

If you have a Supabase project, skip to step A2.

**A1. Create a project** at supabase.com (region close to users, e.g.
`ap-southeast-1` / `ap-northeast-1`). Note the project ref.

**A2. Fill `.env.local`** (template in `.env.example`). All five vars are
required:
- `NEXT_PUBLIC_SUPABASE_URL` — `https://<ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — `sb_publishable_…`
- `SUPABASE_SECRET_KEY` — `sb_secret_…` (server-only, "Sensitive" in Vercel)
- `DATABASE_URL` — **transaction** pooler, port **6543** (runtime, RLS)
- `ADMIN_DATABASE_URL` — **session** pooler, port **5432** (migrations + seed)

Also set these in Vercel (mark the secret + DB URLs Sensitive).

## B. Apply migrations

```bash
npx drizzle-kit migrate
```

Runs `0000`–`0003` over `ADMIN_DATABASE_URL`:
- `0000_smooth_tigra` — companies / profiles / company_members (Phase 0)
- `0001_force_rls` — force RLS on the Phase 0 tables
- `0002_phase1_money_expenses` — cash_accounts, categories, expenses, audit_log + RLS
- `0003_force_rls_phase1` — force RLS on the Phase 1 tables

## C. Seed the tenancy spine (Phase 0 data), then Phase 1 defaults

If this is a fresh project, first create the companies + the owner's profile +
`company_members` rows (Phase 0 §9 decision 4 — Vault Master, Smart Haven,
Saglit Resorts). That requires real `auth.users` ids; create the owner via
Supabase Auth, then insert the rows with the **secret key / SQL editor** (admin
bypasses RLS). Then:

```bash
npm run db:seed
```

`scripts/seed-phase1.ts` adds, **per company**, default cash accounts (Cash on
Hand, GCash, Maya, BPI) and a chart-of-accounts-lite category set. It is
idempotent (unique keys `cash_accounts(company_id,name)` and
`categories(company_id,code)`), so re-running is a no-op.

## D. Create the private `receipts` Storage bucket + policies

The bucket and its RLS policies are version-controlled in
[`scripts/storage-receipts.sql`](../scripts/storage-receipts.sql) (they live in
the `storage` schema, which Drizzle migrations don't manage). Apply them with:

```bash
npm run db:storage
```

This runs the committed SQL over `ADMIN_DATABASE_URL` and is idempotent (safe to
re-run). Storage RLS mirrors table RLS: the object path is `{company_id}/…`, the
first segment is matched against `company_members` — reads for any member, writes
for write-roles only. If your DB role can't create `storage.objects` policies
from the pooler, paste the same file into the Supabase SQL editor instead.

## E. Verify end to end

1. `npm run dev`, log in, open **Expenses**.
2. Create an expense (account + category + amount + receipt) → row appears,
   amount formatted in PHP, receipt opens via a signed URL.
3. Edit and delete it → each writes an `audit_log` row
   (`select action, entity_type, changes from audit_log order by created_at desc`).
4. Switch company → only the active company's expenses show (RLS).
5. A `viewer` cannot create (RBAC throws + RLS denies).
