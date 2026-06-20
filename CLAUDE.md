# CLAUDE.md — Cashflow & Accounting System (PVGC)

## What this is
Internal cashflow, expense, and accounting system for Perez Ventures Group of Companies (PVGC).
Money movement is **driven by orders** (revenue) and **expenses** (outflows); cashflow and
accounting reports are **derived** from them. The system is built to extend into Meta Ads expense
sync and Logistics monitoring **without rework**. Users are non-technical staff.

Priorities, in order: **correctness → security → speed → maintainability.**

> Full spec lives in **`docs/PROJECT_PLAN.md`**. **Read the relevant section there before starting
> any phase.** Do not begin a phase without reading its section first.

---

## Current decisions (confirmed 2026-06-20)
Settled at Phase 0 kickoff. If a later need arises that these don't cover, **ASK before building.**
- **Multi-company** (Vault Master, Smart Haven, Saglit Resorts) with per-company data isolation. ✅ _confirmed_
- **Accounting depth:** management-grade (P&L, expense breakdown, cashflow statement), structured to
  extend to BIR/VAT/double-entry later. ✅ _confirmed_
- **Orders** are the core revenue entity (items, COGS, payment status) and the same record Logistics
  tracks later. ✅ _confirmed_
- **Currency:** PHP base; each transaction stores its original currency + a PHP value (`fx_to_php`). ✅ _confirmed_
- **ORM:** Drizzle. ✅ _confirmed_
- **Roles:** owner, admin, accountant, encoder, viewer. **PIN-gated:** delete, approve, edit posted
  records, expense over **₱10,000**, role change. ✅ _confirmed (threshold ₱10,000)_
- **Greenfield** — no Google Sheets data migration now, but **preserve Google Sheets-compatible column
  headers / export names** so a future import is clean. ✅ _confirmed_

---

## Stack (do not substitute without approval)
- **Next.js 16.2+** (App Router, Server Actions, Cache Components), **React 19**, **Node 20+**.
  Pin to the latest **patched** Next/React releases — security patches land often.
  _Next 16 is a breaking major: see `AGENTS.md` + `node_modules/next/dist/docs/` before writing Next code._
- **Supabase**: Postgres, Auth, Storage, **Vault** (secret storage), Row Level Security.
- **Drizzle ORM** (`drizzle-orm` 0.45.x + **Drizzle Kit** `drizzle-kit` 0.31.x for migrations). _(There is no "Drizzle 7" — the stable line is 0.45 / 0.31; 1.0 is still beta/rc as of 2026-06-20.)_
- **Tailwind v4** + **shadcn/ui**, **TanStack Table**, **Recharts**, **Zod**.
- Deploy: **Vercel**. Scheduled jobs: **Vercel Cron** (simple) / **Inngest** (advanced). Rate limit: **Upstash Redis**.

---

## Architecture rules
- **Reads → React Server Components** (fetch on the server). **Writes → Server Actions only.**
  Do NOT build a public REST API for the client to consume.
- **Feature-folder structure** (`app/(app)/orders`, `/expenses`, `/reports`, …). Shared logic in
  `/lib` (`db`, `auth`, `ledger`, `validation`, `integrations`, `audit`).
- **Cashflow is DERIVED** from orders + expenses — users never enter raw ledger lines.
- **ALL expenses are created via `lib/ledger` → `createExpense()`.** Never insert into `expenses`
  directly. Manual entry, CSV import, recurring, and Meta Ads sync all call this one function.
- **Integrations implement the adapter interface** (`connect` / `sync` / `disconnect`). Tokens go to
  **Supabase Vault**, referenced by ID — never sent to the client.
- **Orders carry logistics lifecycle fields** (`fulfillment_status`, `courier`, `tracking_no`,
  `shipped_at`, `delivered_at`) from the start, nullable until Phase 7.

---

## Security rules (non-negotiable)
- **NO secret keys in client code, ever.** Server context only. Public env is limited to the Supabase
  URL + anon key (safe with RLS on).
- **Two-layer authorization.** Every table has **Row Level Security** keyed to `company_members`,
  AND every Server Action checks role (**RBAC**) before mutating. Both layers, always.
- **Every mutation:** check role → validate with **Zod** → (**PIN-gate** if sensitive) → mutate →
  write `audit_log` via `withAudit()`. **No mutation skips the audit log.**
- **PIN-gated actions:** delete anything, approve, edit a posted record, expense over the configured
  threshold (**₱10,000**), any role change. PIN is hashed in `profiles.action_pin_hash`, separate from login password.
- **Sessions** via Supabase Auth in **httpOnly cookies**. Never store sessions/tokens in localStorage.
- **Rate-limit** login, PIN attempts, and exports.
- **Never commit `.env` or secrets.** Keep them in Vercel / Supabase.

---

## Coding conventions
- **TypeScript strict.** One **Zod schema per form** drives both validation and inferred types.
- Modular, readable functions; **comments only where they add real value**.
- Migrations are **versioned (Drizzle Kit) and committed**. **No schema change without an explicit
  migration AND sign-off.**
- **Preserve existing data headers / Google Sheets compatibility** unless a schema change is approved.
- **UI:** modern, clean, responsive, business-friendly for non-technical users. Brand **teal `#0F766E`
  + charcoal `#1F2937`**. Compact, filterable/searchable tables. Native links that can open in new tabs.

---

## How to work on this project (build discipline)
- **Work ONE phase at a time** (see `docs/PROJECT_PLAN.md` §10). Do not jump ahead.
- For any non-trivial change, **use Plan Mode first**: propose the approach, files touched, migrations,
  and new env vars, and **wait for approval** before writing code.
- Consider **both frontend and backend impact** on every change.
- **Do NOT remove or break an existing feature** unless explicitly asked.
- When a change needs a new env var, sheet column, table, or permission, **say so explicitly, up front**.
- When there's a real tradeoff, **offer two options**: safest/simple vs advanced/scalable.
- **Ask before any destructive or irreversible action** (deletes, drops, force-push, production deploy).

---

## Definition of done (every task)
- [ ] Frontend + backend impact handled
- [ ] No existing feature removed unless requested
- [ ] RLS + RBAC + audit covered for any new mutation
- [ ] No secret exposed; no client/server naming mismatch
- [ ] New env vars / sheet columns / migrations called out
- [ ] Matches the stack + conventions above

---

## Commands
_(Placeholders — update after the Phase 0 scaffold.)_
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
- DB migrate: `npx drizzle-kit generate` then `npx drizzle-kit migrate`
- Test: `npm run test`
