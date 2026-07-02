# Cashflow, Expense & Accounting System — Architecture & Build Plan

**Prepared for:** Mark / Perez Ventures Group of Companies (PVGC)
**Scope:** Order-driven cashflow + expense entry + accounting reports, built to extend cleanly into Meta Ads expense sync and Logistics monitoring.
**Date:** June 2026
**Stack verified current as of:** 2026-06-20 (Next.js 16.2.9, React 19.2.7, Drizzle `drizzle-orm` 0.45.2 / `drizzle-kit` 0.31.10). _Correction: an earlier draft cited "Drizzle 7.x" — no such release exists; the stable line is 0.45 / 0.31. See `docs/PHASE_0_PLAN.md`._

> **Read this first — assumptions.** This plan is built on a set of informed defaults (multi-company, management-grade accounting, orders as a first-class entity, PHP base currency, Drizzle ORM). Each one is listed in **Section 12 – Open Decisions** with my recommendation. Confirm or redirect those and the plan locks in. Nothing below requires a rewrite if you change them — the data model is designed to flex.

---

## 1. Vision & what we are actually building

A single internal system where money movement is **driven by orders and expenses**, not entered as abstract ledger lines. Each order is a revenue event (with items, COGS, and payment status); each expense is an outflow (manual today, auto-synced from Meta Ads tomorrow). On top of these two source streams sit a live **cashflow view**, a set of **accounting reports**, and a dashboard with KPIs.

The architecture treats two future features as first-class citizens from day one, so they bolt on without refactoring:

- **Meta Ads connection** → ad spend becomes expenses through a generic *expense source* pipeline. The Meta connector is just one producer feeding the same `createExpense` path everything else uses.
- **Logistics monitoring** → because orders are modeled richly now (status + fulfillment lifecycle fields), the logistics module reads/writes the same order records plus a `shipments` table. No schema rewrite.

Three principles govern every decision: **speed** (server-rendered data, edge-friendly ORM, indexed reads), **security** (no secrets in the client, defense-in-depth via app-level RBAC *and* database RLS, PIN-gated sensitive actions, full audit trail), and **extensibility** (feature-folder structure, integration adapter pattern, event hooks).

---

## 2. Guiding principles

| Principle | How it shows up in the build |
|---|---|
| **Speed** | React Server Components fetch data server-side (no client waterfalls); Drizzle's ~7KB runtime keeps serverless cold starts under ~50ms; Postgres indexes on `company_id` + dates + status; pagination + virtualized tables for large order/expense lists; cached report results invalidated on new entries. |
| **Security** | Supabase Auth with httpOnly cookies (never localStorage); **two layers** of access control — RBAC enforced in Server Actions *and* Row Level Security enforced at the database; PIN-gating on destructive/financial actions; all integration tokens server-side only (Supabase Vault); Zod validation on every input; audit log on every mutation. |
| **Extensibility** | Domain feature folders; expense *source* abstraction; integration *adapter* interface (`connect` / `sync` / `disconnect`); order lifecycle fields present from the start; webhook route handlers ready for Meta + courier callbacks. |
| **Stability & maintainability** | TypeScript strict mode; single source of truth per concern (`lib/db`, `lib/auth`, `lib/ledger`); migrations versioned in git; no breaking changes to schema without an explicit migration. |

---

## 3. Tech stack (verified current — June 2026)

### Recommended stack

| Layer | Choice | Why |
|---|---|---|
| **Framework** | **Next.js 16.2.x** (App Router, Server Actions, Cache Components) | Current stable LTS as of June 2026; Turbopack is now the default bundler; Server Actions are mature, so mutations run server-side with no separate API layer to secure. Requires **Node.js 20+**. |
| **UI runtime** | **React 19.x** | Bundled with Next 16. *Pin to the latest patched release* — a coordinated security release in May 2026 (incl. an RSC advisory) means you should run patched React/Next versions, not whatever was cached. |
| **Database + Auth + Storage** | **Supabase** (Postgres 15+) | One platform for DB, Auth (sessions), file Storage (receipts), Realtime, Row Level Security, and **Vault** (encrypted secret storage for integration tokens). Pairs natively with Drizzle. |
| **ORM** | **Drizzle ORM** (`drizzle-orm` 0.45.x + `drizzle-kit` 0.31.x) *(recommended)* | In 2026 Drizzle overtook Prisma for exactly this profile: Supabase Postgres on Vercel serverless. ~7KB runtime, near-zero cold-start tax, SQL-like control, code-first (schema *is* your TypeScript), and **built-in RLS helpers** — directly relevant to your multi-company + security requirements. |
| **Styling** | **Tailwind CSS v4** + **shadcn/ui** | Clean, modern, business-friendly components you fully own and can theme to teal/charcoal. No heavy component-library lock-in. |
| **Tables** | **TanStack Table v8** | Your preferred compact, filterable, searchable tables with sorting/pagination/column control. |
| **Charts / KPIs** | **Recharts** (or **Tremor** for dashboard-native KPI blocks) | Fast, clean KPI cards and trend charts for the cashflow dashboard. |
| **Validation** | **Zod** | One schema validates form input *and* infers TypeScript types — enforced server-side in every Server Action. |
| **Scheduled jobs** | **Vercel Cron** *(simple)* or **Inngest / Trigger.dev** *(advanced)* | For Meta Ads scheduled syncs and recurring expenses. Cron is enough to start; Inngest/Trigger.dev add retries, observability, and step functions when reliability matters. |
| **Rate limiting** | **Upstash Redis** | Throttle sensitive endpoints (login, PIN attempts, exports). |
| **Hosting** | **Vercel** (app) + **Supabase** (data) | Your known deployment path; env vars and secrets stay server-side in Vercel + Supabase. |

### Safe / familiar alternative
If you'd rather stay on ground you've already shipped on, swap **Drizzle → Prisma 7**. Prisma 7 removed the Rust engine and works on edge now; the trade-off is a larger bundle and a measurable cold-start tax on serverless (mitigated by Prisma Accelerate, which adds cost). Everything else in this plan is identical — the choice doesn't change how data fetching or Server Actions are structured. **My recommendation is Drizzle** for the speed + RLS fit, but Prisma is a fully valid "safe" path.

> **Font note:** Keep your brand **teal `#0F766E` / charcoal `#1F2937`** for this web app. For on-screen UI, use a modern web font (Inter or Geist) rather than Arial — Arial stays the standard for your **.docx** deliverables, but a web app reads cleaner and more modern with a UI-grade typeface. Flag if you want strict Arial here too.

---

## 4. High-level architecture

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (non-technical users)                               │
│  Next.js App Router · shadcn/ui · TanStack Table · Recharts  │
│  - Server Components render reports/dashboards (data on srv) │
│  - Server Actions handle all writes (no public API surface)  │
└───────────────┬─────────────────────────────────────────────┘
                │  (httpOnly session cookie)
┌───────────────▼─────────────────────────────────────────────┐
│  NEXT.JS SERVER (Vercel)                                     │
│  - RBAC checks  - Zod validation  - PIN-gate verification    │
│  - lib/ledger (posts cashflow)  - audit logging              │
│  - Route Handlers: /api/webhooks/meta, /api/webhooks/courier │
│  - Cron jobs: meta-sync, recurring-expenses                  │
└───────────────┬───────────────────────────┬─────────────────┘
                │ Drizzle                    │ adapters
┌───────────────▼──────────────┐  ┌──────────▼─────────────────┐
│  SUPABASE POSTGRES           │  │  INTEGRATION ADAPTERS       │
│  - Tables + RLS policies     │  │  - MetaAdsAdapter (Ph6)     │
│  - Views: cashflow, P&L      │  │  - (future: bank, courier)  │
│  - Vault: encrypted tokens   │  │  interface: connect/sync/   │
│  - Storage: receipts         │  │             disconnect      │
└──────────────────────────────┘  └────────────────────────────┘
```

**Why this shape is fast and secure:** there is *no* public REST API for the client to hit. The browser holds only a session cookie; every read happens in a Server Component close to the database, and every write goes through a Server Action that checks role → validates input → (optionally) verifies PIN → mutates → writes an audit record. Even if app logic were bypassed, Postgres RLS independently blocks cross-company access.

---

## 5. Data model (core + future)

Tables added per phase, but designed as one coherent model. `→` = foreign key.

### Core (Phases 0–4)
- **`companies`** — `id, name, slug, base_currency (default PHP), created_at`
- **`profiles`** — `id (= auth.users.id), full_name, action_pin_hash, created_at` *(PIN stored hashed, separate from login password)*
- **`company_members`** — `user_id →profiles, company_id →companies, role (owner|admin|accountant|encoder|viewer)` *(per-company roles; this is what enables the multi-entity switcher and RLS)*
- **`cash_accounts`** — `id, company_id, name (e.g. BPI, GCash, Cash on Hand), type (bank|ewallet|cash), opening_balance, currency` *(PH-relevant: track GCash/Maya/bank/cash separately)*
- **`categories`** — `id, company_id, name, kind (income|cogs|expense), code, parent_id (self →, for chart-of-accounts hierarchy)`
- **`orders`** — `id, company_id, order_no, customer_name, channel, order_date, status, payment_status (unpaid|partial|paid), subtotal, shipping_fee, discount, total, currency, notes` + **logistics-ready nullable fields**: `fulfillment_status, courier, tracking_no, shipped_at, delivered_at`
- **`order_items`** — `id, order_id →, product_name, sku, qty, unit_price, unit_cost (for COGS), line_total`
- **`expenses`** — `id, company_id, expense_date, category_id →, cash_account_id →, vendor, description, amount, currency, fx_to_php, source (manual|meta_ads|import|recurring), source_ref (external id), receipt_url, status (draft|approved), created_by →`
- **`ledger_entries`** — `id, company_id, cash_account_id →, entry_date, direction (in|out), amount, source_type (order|expense|transfer|adjustment), source_id, category_id →` *(the spine of cashflow + account balances — see Section 8)*
- **`audit_log`** — `id, actor_id →, company_id, action, entity_type, entity_id, changes (jsonb before/after), ip, created_at`

### Future (added when the phase lands)
- **`integrations`** *(Phase 6)* — `id, company_id, provider (meta_ads), status, vault_secret_ref, config (jsonb), last_synced_at` *(token lives in Supabase Vault; this table only references it)*
- **`ad_campaigns` / `ad_spend`** *(Phase 6)* — campaign-level spend that posts into `expenses` with `source = meta_ads`
- **`shipments`** *(Phase 7)* — `id, order_id →, courier, tracking_no, status, picked_up_at, in_transit_at, delivered_at, cost`
- **`approvals`** *(Phase 5, optional)* — `id, company_id, entity_type, entity_id, requested_by →, approved_by →, status, approved_at` *(for PIN-gated approval workflows)*

---

## 6. Security model (deep — you flagged this hard)

1. **Authentication** — Supabase Auth (email/password or magic link). Sessions stored in **httpOnly, secure cookies** via `@supabase/ssr`. Never in localStorage (XSS-exposed).
2. **Two-layer authorization (defense in depth):**
   - *App layer:* every Server Action begins with a role check against `company_members` for the active company before doing anything.
   - *Database layer:* **RLS policies on every table** keyed to the user's `company_members` rows. A user physically cannot read or write another company's data even if app logic has a bug. Drizzle's RLS helpers make these policies maintainable in code.
3. **PIN-gated actions** — sensitive operations require a recently-verified action PIN (hashed in `profiles.action_pin_hash`, *separate* from the login password). On success, a short-lived server-side token authorizes the action. **PIN-gated by default:** delete anything, approve an expense/order, edit a *posted* record, any expense over a configurable threshold (e.g. ₱X), and any role/permission change.
4. **Secrets** — *zero* secret keys in client code. Service-role keys and the like run only in server context. Integration tokens (Meta, etc.) live in **Supabase Vault**, referenced by ID, never returned to the browser. Public env vars are limited to the Supabase anon key + URL (which are safe by design with RLS on).
5. **Audit trail** — every create/update/delete writes an `audit_log` row (actor, action, before/after JSON, IP). This is your auditability requirement, satisfied centrally via a shared `withAudit()` helper so no mutation can silently skip it.
6. **Validation** — Zod schemas validate all input server-side. The same schema drives the form, so client and server never disagree.
7. **Rate limiting** — Upstash Redis throttles login, PIN attempts, and exports to blunt brute-force and abuse.
8. **Session policy** — configurable idle timeout; re-auth required for high-risk actions even within a valid session.

---

## 7. Speed strategy

- **Server-rendered reads:** dashboards and reports are React Server Components — data is fetched on the server, next to Postgres, and streamed as HTML. No client-side fetch waterfalls, no spinner-on-spinner.
- **Edge-friendly ORM:** Drizzle's tiny runtime means serverless functions cold-start fast (sub-50ms vs Prisma's heavier engine tax).
- **Connection pooling:** Supabase Supavisor (PgBouncer-compatible) handles serverless connection churn.
- **Indexing:** composite indexes on `(company_id, entry_date)`, `(company_id, status)`, and all foreign keys. Report queries hit indexes, not full scans.
- **Big lists:** server-side pagination + TanStack virtualization so a 50,000-row order table renders instantly.
- **Report caching:** expensive aggregate reports are cached with Next.js cache tags and invalidated precisely when a relevant order/expense is written — so reports are instant but never stale.
- **Optimistic UI:** entry forms update the screen immediately, then reconcile with the server.

---

## 8. Extensibility design (the core of your ask)

**A. Expense source abstraction.** Every expense row carries a `source` (`manual | meta_ads | import | recurring`). *All* of them are created through one service function, `createExpense()`. Manual entry calls it; the CSV importer calls it; the Meta Ads sync job calls it. Reports and cashflow never know or care where an expense came from. **Adding Meta Ads later = writing a sync job that calls the existing service.** No change to reports, dashboard, or cashflow logic.

**B. Integration adapter interface.** A generic `integrations` table plus a TypeScript interface every provider implements:
```ts
interface IntegrationAdapter {
  connect(config): Promise<void>;     // store token in Vault
  sync(): Promise<SyncResult>;        // pull data → createExpense()
  disconnect(): Promise<void>;        // revoke + clear
}
```
`MetaAdsAdapter` is the first implementation. Future adapters (bank feeds, payment gateways, couriers) drop in without touching core code.

**C. Orders modeled for logistics from day one.** Orders carry `status` and nullable fulfillment fields (`fulfillment_status`, `courier`, `tracking_no`, `shipped_at`, `delivered_at`) now. The Logistics module (Phase 7) reads/writes these plus a `shipments` table. Because orders are already first-class, **logistics bolts on with zero rewrite of cashflow**.

**D. Event hooks.** A small internal event dispatcher fires on key transitions (e.g. `order.paid → post ledger inflow`). New side-effects (notify, sync, post) are added by subscribing to events, not by editing existing functions.

**E. Cashflow ledger design.** Orders and expenses are the *source of truth*; cashflow is derived.
- *Safe / simple:* derive cashflow and account balances from Postgres **views** over orders + expenses. Always correct, zero maintenance, great until data volume gets large.
- *Advanced / scalable:* maintain a posted **`ledger_entries`** table (populated by the event dispatcher / DB functions) plus **materialized views** for heavy reports, refreshed on write. Faster for large datasets and historical reporting.
- **Recommendation:** start with views (Phase 3), introduce the posted ledger + materialized views in Phase 4 when reports get heavier. The `ledger_entries` table is in the schema from the start so the upgrade is non-breaking.

---

## 9. Project structure (feature-folder)

```
/app
  /(auth)/login
  /(app)
    /dashboard            # KPIs, cashflow charts
    /orders               # list, create, detail (+ logistics tab later)
    /expenses             # list, create, approve
    /accounts             # cash accounts + balances
    /reports              # P&L, cashflow statement, exports
    /integrations         # connect Meta Ads (Phase 6)
    /logistics            # shipments dashboard (Phase 7)
    /settings             # users, roles, categories, company switch
  /api
    /webhooks/meta        # Meta callbacks (Phase 6)
    /webhooks/courier     # courier callbacks (Phase 7)
    /cron/meta-sync       # scheduled sync
/lib
  /db                     # Drizzle client + schema
  /auth                   # session, RBAC, PIN verification
  /ledger                 # cashflow posting + balance logic
  /validation             # Zod schemas
  /integrations           # adapter interface + MetaAdsAdapter
  /audit                  # withAudit() helper
/components                # shadcn/ui-based shared UI (teal/charcoal theme)
```

Each domain folder owns its Server Components, Server Actions, and components. Shared concerns live in `/lib` as the single source of truth.

---

## 10. Phased roadmap

Each phase is shippable on its own and respects your one-module-at-a-time style. Security is foundational, not bolted on at the end.

> **Delivery status (updated 2026-07-02):** Phases 0–5, 7, and 8 are shipped and merged to `main` (PRs #1–#7). **Phase 6 (Meta Ads) is checkpointed** — it needs an external Meta developer app (App ID/Secret, ad account, OAuth redirect URI) that hasn't been provisioned; all other phases were built around it so it bolts on with no rewrite. Phase 8 shipped an initial slice (expense auto-categorization + cashflow insights); receipt OCR, natural-language queries, and forecasting remain as follow-ons.

### Phase 0 — Foundations & scaffolding
**Goal:** a deployed skeleton with auth, the data layer, the design system, and CI/CD.
**Deliverables:** Next 16 + Tailwind v4 + shadcn/ui scaffold; Supabase project; Drizzle schema for `companies / profiles / company_members`; Supabase Auth login + httpOnly sessions; baseline RLS; teal/charcoal theme + app shell (sidebar nav, company switcher); Vercel deploy + env/secret setup.
**Done when:** a user can log in, land on an empty dashboard, switch between companies, and the app is live on Vercel with no secrets in the client.

### Phase 1 — Money accounts & expense entry
**Goal:** start capturing outflows.
**Deliverables:** `cash_accounts`, `categories`, `expenses` tables + RLS; expense create/edit/list with Zod validation; category management (chart-of-accounts-lite); receipt upload to Supabase Storage; `withAudit()` wired in; compact filterable expense table (TanStack).
**Done when:** an encoder can log an expense against an account + category with a receipt, and every action is audited.

### Phase 2 — Orders & order-driven cashflow
**Goal:** capture inflows and COGS the way the business actually works.
**Deliverables:** `orders` + `order_items` tables (with logistics-ready fields nullable); order create/edit/list; payment status; COGS from `unit_cost`; on `order.paid`, post an inflow.
**Done when:** an order with items and a payment status produces a cash inflow and contributes COGS.

### Phase 3 — Cashflow dashboard
**Goal:** see the money.
**Deliverables:** cashflow views (inflow/outflow/net, running balance per account); dashboard KPIs (cash on hand, period inflow/outflow, net, runway); date-range + per-company filters; trend charts; export current view.
**Done when:** the dashboard shows accurate, fast, filterable cashflow across companies.

### Phase 4 — Accounting reports & exports
**Goal:** real reports.
**Deliverables:** P&L (income − COGS − expenses by category); expense-by-category breakdown; cashflow statement; period-over-period comparison; CSV / Excel / PDF export; introduce posted `ledger_entries` + materialized views for performance. *(If BIR-grade output is needed — see Open Decisions — add VAT/withholding fields and OR/Sales-Invoice numbering here.)*
**Done when:** management can pull a P&L and cashflow statement for any period and export it.

### Phase 5 — Security hardening & permissions
**Goal:** lock it down for real-world roles.
**Deliverables:** full RBAC matrix (owner/admin/accountant/encoder/viewer); PIN-gated actions live (delete, approve, posted-record edits, large expenses, role changes); optional approval workflow (`approvals`); audit-log viewer UI; rate limiting; session/idle policy.
**Done when:** each role sees only what it should, sensitive actions require a PIN, and admins can review the audit trail.

### Phase 6 — Meta Ads integration
**Goal:** ad spend flows in automatically.
**Deliverables:** `integrations` + `ad_campaigns`/`ad_spend`; OAuth connect flow (token → Supabase Vault); `MetaAdsAdapter.sync()` pulling spend → `createExpense()` with `source = meta_ads`; scheduled sync (Cron or Inngest); campaign→category mapping; webhook handler.
**Done when:** connecting a Meta account auto-imports ad spend as categorized expenses on a schedule, with no manual entry.

### Phase 7 — Logistics monitoring
**Goal:** track order fulfillment.
**Deliverables:** `shipments` table; fulfillment lifecycle on orders (packed → shipped → in transit → delivered); courier + tracking; logistics dashboard (status board, in-transit, delayed); optional courier webhook for live status.
**Done when:** every order's fulfillment status is visible and updatable, with a logistics dashboard — built entirely on the existing order model.

### Phase 8 — AI layer
**Goal:** make it smart.
**Deliverables:** expense auto-categorization (LLM classifies vendor/description → category); receipt OCR (image → structured expense draft); cashflow insights + anomaly flags (LLM narrates trends, flags unusual spend); natural-language report queries ("show Meta Ads spend last month per company"); optional forecasting.
**Done when:** the system suggests categories, reads receipts, and answers plain-language questions about the numbers — all with keys server-side only.

---

## 11. AI instructions

You asked for "AI instructions," which I'm reading two ways — both are covered.

### 11A. Building this *with* AI — project rules file
Drop this into the repo as `CLAUDE.md` (or `.cursorrules`, or Lovable project instructions) so any AI tool builds consistently and never breaks the architecture. It encodes your working preferences directly.

```md
# Project Rules — Cashflow & Accounting System

## Stack (do not substitute without approval)
- Next.js 16.2+ (App Router, Server Actions), React 19, Node 20+
- Supabase (Postgres, Auth, Storage, Vault), Drizzle ORM (drizzle-orm 0.45.x)
- Tailwind v4 + shadcn/ui, TanStack Table, Recharts, Zod
- Deploy: Vercel. Data: Supabase.

## Architecture rules
- Reads: React Server Components (fetch on the server).
- Writes: Server Actions only. Do NOT build a public REST API for the client.
- Every domain lives in its own feature folder; shared logic in /lib.
- Cashflow is derived from orders + expenses — never entered directly.
- All expenses go through createExpense(); never insert into `expenses` directly.

## Security rules (non-negotiable)
- No secret keys in client code, ever. Server context only.
- Integration tokens go in Supabase Vault, referenced by ID.
- Every table has RLS keyed to company_members. App-level RBAC AND DB RLS.
- Every mutation: check role -> validate with Zod -> (PIN-gate if sensitive)
  -> mutate -> write audit_log via withAudit().
- Sensitive (PIN-gated): delete, approve, edit posted records,
  expenses over threshold, role changes.

## Coding conventions
- TypeScript strict. Zod schema is the single source of truth for a form
  (validates input + infers types).
- Modular, readable functions. Comments only where they add value.
- Preserve existing data headers / sheet compatibility — no schema change
  without an explicit migration AND sign-off.

## Definition of done (every task)
- Frontend AND backend impact considered.
- No existing feature removed unless explicitly requested.
- RLS + RBAC + audit covered for any new mutation.
- No new secret exposed; no naming mismatch between client and server.
- State any new sheet column, env var, or permission the change requires.
```

### 11B. AI features *inside* the app (Phase 8)
- **Auto-categorization** — LLM maps vendor/description to a category, encoder confirms.
- **Receipt OCR** — image → structured expense draft (date, vendor, amount, tax).
- **Cashflow insights** — LLM summarizes trends and flags anomalies ("ad spend up 40% vs last month").
- **NL report queries** — plain-language questions answered against the data.
- **Security:** all AI calls run server-side; keys never reach the browser. If you want the in-app "Claude-in-Claude" pattern, the Anthropic API can be called from Server Actions with the key held server-side — same rule as every other secret.

---

## 12. Open decisions (please confirm or redirect)

These genuinely change the build. My recommendation is in **bold**; the architecture flexes to either way.

1. **Multi-company?** One system spanning Vault Master / Smart Haven / Saglit Resorts with a company switcher and per-company data isolation. **Rec: yes, multi-entity from the start** — cheap now, painful to retrofit. The whole RLS/role model assumes this.
2. **Accounting depth?** Management-grade reports (P&L, expense breakdown, cashflow statement) vs full **BIR-compliant / double-entry** (VAT, withholding, official-receipt numbering, formal financial statements). **Rec: management-grade single-entry ledger now, structured to extend to BIR/VAT later.** Tell me if you need BIR forms or formal statements soon — that pulls tax fields into Phase 4.
3. **Orders as the core revenue entity?** Each order = a sale with items, COGS, and payment status, and it's the *same* record logistics will later track. **Rec: yes — model orders richly now** (your message implies this).
4. **Currency handling?** PHP base, but Meta Ads is often billed in USD. **Rec: store each transaction in its original currency + a PHP value at entry time** (simple `fx_to_php` field), rather than full multi-currency accounting. Confirm if you bill customers in other currencies.
5. **ORM choice?** **Rec: Drizzle** (speed + RLS fit). Or **Prisma** if you'd rather stay on what you've shipped before. Everything else is identical.
6. **Roles + PIN scope?** Proposed roles: **Owner, Admin, Accountant, Encoder, Viewer.** Proposed PIN-gated actions: deletes, approvals, posted-record edits, expenses over ₱X, role changes. Confirm the role set and the peso threshold.
7. **Greenfield or migration?** Are we starting clean, or **migrating existing Google Sheets cashflow data**? If migrating, we add a one-time import step (likely after Phase 2).

---

## 13. Recommended next step

Confirm the seven decisions above (even a quick "1-yes, 2-management-grade, 3-yes, 4-PHP+fx, 5-Drizzle, 6-fine, 7-greenfield" works). Once locked, we start **Phase 0** — I'll hand you the repo scaffold, the Drizzle schema for the first three tables, the Supabase Auth + RLS setup, and the teal/charcoal app shell, as copy-paste-ready blocks with exact placement, one module at a time.
