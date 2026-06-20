<!-- Generated 2026-06-20 from web-verified research. Phase 0 plan for the PVGC cashflow & accounting system. -->

# Phase 0 Implementation Plan — Cashflow & Accounting System (PVGC)

**Status:** for human approval. No code is written yet. All versions below were verified live against npm on 2026-06-20.

> **Critical correction up front:** the plan and `CLAUDE.md` say "Drizzle ORM 7." **There is no Drizzle 7.x.** The current stable line is `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10`; `1.0.0` is still `-beta`/`-rc` (latest pre-release `1.0.0-rc.3`). This plan pins the **stable 0.45 / 0.31 line**, which is where all the RLS helpers (`pgPolicy`, `drizzle-orm/supabase`, `crudPolicy`-is-Neon-only) actually ship. I recommend we update `CLAUDE.md` to say "Drizzle ORM (drizzle-kit 0.31.x / drizzle-orm 0.45.x)" to kill the "7.x" myth.

---

## 1. Verified versions to pin

| Package | Pin | Verified latest (npm, 2026-06-20) | Flag / note |
|---|---|---|---|
| `next` | `16.2.9` | `16.2.9` (`latest`) | ✅ Matches plan. **Must be ≥ 16.2.6** (May 2026 RSC DoS, CVE-2026-23870). |
| `react` | `19.2.7` | `19.2.7` | ⚠️ Research said pin `19.2.6`; **live latest is `19.2.7`** (also patched, ≥19.2.6). Pin `19.2.7`. |
| `react-dom` | `19.2.7` | `19.2.7` | Pin together with `react`. |
| `typescript` | `^5.6` (min 5.1) | — | Next 16 floor is TS 5.1.0+. Use whatever `create-next-app` generates. |
| Node | `>=20.9.0` | — | Hard floor in Next 16 (Node 18 dropped). Use Node 20 LTS or 22. |
| `drizzle-orm` | `0.45.2` | `0.45.2` (`latest`) | 🚩 **NOT "7.x" — does not exist.** Stable line. RLS helpers present. |
| `drizzle-kit` | `0.31.10` | `0.31.10` (`latest`) | 🚩 Pairs with orm 0.45. Use `generate`+`migrate` (not `push`) for RLS. |
| `postgres` (postgres-js) | `3.4.9` | `3.4.9` | Driver per Drizzle's Supabase guide. **`{ prepare: false }` mandatory** on the 6543 pooler. |
| `@supabase/ssr` | `0.12.0` | `0.12.0` | ✅ Matches research. `getAll`/`setAll` only. |
| `@supabase/supabase-js` | `2.108.2` | `2.108.2` | ✅ |
| `tailwindcss` | `4.3.1` | `4.3.1` | ✅ CSS-first, no `tailwind.config.js`. |
| `@tailwindcss/postcss` | `4.3.1` | `4.3.1` | ✅ PostCSS plugin (not `tailwindcss`). |
| `shadcn` (CLI) | `4.11.0` (`@latest`) | `4.11.0` | Run via `npx shadcn@latest`; package is `shadcn` (not `shadcn-ui`). |
| `tw-animate-css` | `1.4.0` | `1.4.0` | Replaces `tailwindcss-animate`; imported in `globals.css`. |
| `class-variance-authority` | `0.7.1` | `0.7.1` | Pulled in by shadcn. |
| `tailwind-merge` | `3.6.0` | `3.6.0` | Pulled in by shadcn (`cn()`). |
| `lucide-react` | `1.21.0` | `1.21.0` | ⚠️ Note major is `1.x` now, not `0.x` — `iconLibrary: lucide`. |
| `zod` | `4.4.3` | `4.4.3` | ⚠️ Zod is on **v4** (`4.4.3`), not v3. Confirm we adopt Zod 4 API. |
| `@tanstack/react-table` | `8.21.3` | `8.21.3` | Not used in Phase 0 — pin when Phase 1 tables land. |
| `recharts` | `3.8.1` | `3.8.1` | Not used in Phase 0 — pin when Phase 3 dashboard lands. |
| `jose` | `6.2.3` | `6.2.3` | **Recommended add** for decoding the Supabase access token in the RLS wrapper (research used a hand-rolled `decode`). |

**Uncertain / to confirm:** (a) Zod v4 vs sticking on v3 — research snippets assume generic Zod; v4 has API changes. (b) Whether to add `jose` now or defer the Drizzle RLS-aware wrapper to Phase 1 (see §9). (c) `lucide-react` is on `1.x` — cosmetic, but worth noting it's no longer `0.x`.

---

## 2. Build order

Each numbered step is one reviewable unit (≈ one commit / one PR).

**Group A — Scaffold & pin**
1. `npx create-next-app@latest aven-erp --ts --app --src-dir --tailwind --eslint --import-alias "@/*" --use-npm` into the repo. (Explicit flags, not `--yes`, because we want `src/` and need to avoid the interactive prompts. `--yes` does NOT give `src/`.)
2. Pin secured versions: `npm i next@16.2.9 react@19.2.7 react-dom@19.2.7`. Verify with `npm ls next react react-dom`.
3. `next.config.ts`: add `cacheComponents: true` (opt-in PPR + `'use cache'` model). Leave `reactCompiler` off for now (Babel build-time cost).
4. Commit baseline scaffold + a `.env.example` and confirm `.gitignore` already ignores `.env*` (it does in this repo).

**Group B — Theme & app shell**
5. Confirm Tailwind v4 wiring: `postcss.config.mjs` uses `@tailwindcss/postcss`; `globals.css` is `@import "tailwindcss";` (no `@tailwind` directives, no `tailwind.config.js`).
6. `npx shadcn@latest init` → base color **neutral**, style **new-york**, CSS variables **yes**, icon **lucide**. Confirm `components.json` has `tailwind.config: ""`.
7. `npx shadcn@latest add sidebar-07 button card input dropdown-menu avatar separator breadcrumb skeleton` (sidebar-07 brings the app-shell block + company switcher).
8. Apply the teal/charcoal `@theme inline` + `:root`/`.dark` token block (§6) to `globals.css`.

**Group C — Supabase project & secrets**
9. **DECISION GATE (§9):** provision the Supabase project (via MCP `create_project` or manually) → capture project URL, publishable key, secret key, and the two connection strings.
10. Add env vars locally (`.env.local`) and to Vercel per-environment (§7). Mark server secrets **Sensitive**.

**Group D — Data layer (Drizzle + RLS)**
11. Install `drizzle-orm@0.45.2 postgres@3.4.9 jose@6.2.3` and `-D drizzle-kit@0.31.10`.
12. `src/lib/db/schema.ts` — `companies`, `profiles`, `company_members` with `pgPolicy` RLS (§4).
13. `drizzle.config.ts` — `dialect: postgresql`, `casing: snake_case`, `dbCredentials.url = DIRECT_URL`, `entities.roles.provider = 'supabase'`.
14. `src/lib/db/client.ts` (admin + RLS-enforcing postgres-js clients, `prepare: false`) and `src/lib/db/rls.ts` (the `.rls()` transaction wrapper).
15. `npx drizzle-kit generate` → review the emitted SQL (CREATE TABLE + ENABLE RLS + CREATE POLICY) → `npx drizzle-kit migrate` over the **DIRECT** URL.

**Group E — Auth & RBAC**
16. `src/lib/supabase/{client,server,proxy}.ts` (browser, server, `updateSession`).
17. `proxy.ts` at project root (Next 16 — **not** `middleware.ts`), exporting `proxy` + matcher.
18. `src/app/(auth)/login/{page.tsx,actions.ts}` — email/password login Server Action.
19. `src/lib/auth/rbac.ts` — `getActiveCompany()` + `requireRole()` helpers reading `company_members`.

**Group F — Shell pages & company switch**
20. `src/app/(app)/layout.tsx` (SidebarProvider + AppSidebar + top bar) gated by `getClaims()`.
21. `src/app/(app)/dashboard/page.tsx` — empty dashboard.
22. Company switcher wired to `company_members` + a `setActiveCompany` Server Action writing an httpOnly `active_company` cookie.

**Group G — Deploy**
23. Push to GitHub; connect repo to Vercel (Git integration). Confirm Production + Preview env vars set. First production deploy via push to `main`.
24. Smoke test: log in → land on empty dashboard → switch company → confirm no secret in client bundle (grep built `_next/static` for `sb_secret`/`DATABASE_URL`).

---

## 3. File & folder tree (Phase 0 only)

```
aven-erp/
├── proxy.ts                         # Next 16: session refresh (was middleware.ts)
├── next.config.ts                   # cacheComponents: true
├── drizzle.config.ts                # migrations via DIRECT_URL, entities.roles=supabase
├── postcss.config.mjs               # @tailwindcss/postcss
├── components.json                  # shadcn (tailwind.config: "")
├── .env.example
├── package.json
└── src/
    ├── app/
    │   ├── layout.tsx               # root <html><body>
    │   ├── globals.css              # @import tailwindcss + teal/charcoal @theme
    │   ├── (auth)/
    │   │   └── login/
    │   │       ├── page.tsx
    │   │       └── actions.ts       # 'use server' login()
    │   └── (app)/
    │       ├── layout.tsx           # SidebarProvider + AppSidebar + top bar (auth-gated)
    │       ├── actions.ts           # 'use server' setActiveCompany()
    │       └── dashboard/
    │           └── page.tsx         # empty dashboard
    ├── components/
    │   ├── app-sidebar.tsx          # from sidebar-07
    │   ├── company-switcher.tsx     # team-switcher repurposed → company_members
    │   ├── nav-main.tsx
    │   ├── nav-user.tsx
    │   └── ui/                       # shadcn primitives (button, card, sidebar, …)
    └── lib/
        ├── utils.ts                 # cn()
        ├── supabase/
        │   ├── client.ts            # createBrowserClient
        │   ├── server.ts            # createServerClient (async, await cookies())
        │   └── proxy.ts             # updateSession()
        ├── db/
        │   ├── schema.ts            # companies / profiles / company_members + RLS
        │   ├── client.ts            # admin + rls postgres-js clients (prepare:false)
        │   ├── rls.ts               # createDrizzle / .rls() transaction wrapper
        │   └── migrations/          # drizzle-kit output (committed)
        └── auth/
            └── rbac.ts              # getActiveCompany(), requireRole()
```

Deferred to later phases (NOT created now): `/lib/ledger`, `/lib/validation`, `/lib/integrations`, `/lib/audit`, `/api/webhooks/*`, all domain folders beyond `dashboard`.

---

## 4. Drizzle schema (companies / profiles / company_members) + RLS

Idiomatic to the research: `pgPolicy` + helpers from `drizzle-orm/supabase` (`authenticatedRole`, `authUid` = `(select auth.uid())`). Adding any policy auto-enables RLS. Columns use **Google-Sheets-compatible snake_case headers** per CLAUDE.md, with `casing: 'snake_case'` mapping camelCase TS → snake_case DB.

```ts
// src/lib/db/schema.ts
import { sql } from 'drizzle-orm';
import {
  pgTable, pgPolicy, uuid, text, timestamp, primaryKey, pgEnum,
} from 'drizzle-orm/pg-core';
import { authenticatedRole, authUid } from 'drizzle-orm/supabase';

export const companyRole = pgEnum('company_role', [
  'owner', 'admin', 'accountant', 'encoder', 'viewer',
]);

// companies — id, name, slug, base_currency (default PHP), created_at
export const companies = pgTable('companies', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         text('name').notNull(),
  slug:         text('slug').notNull().unique(),
  baseCurrency: text('base_currency').notNull().default('PHP'),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // A user can read only companies they are a member of.
  pgPolicy('companies_select_members', {
    for: 'select', to: authenticatedRole,
    using: sql`${t.id} in (
      select company_id from company_members where user_id = ${authUid}
    )`,
  }),
  // Writes to companies are owner/admin-only (Phase 0 keeps inserts server-side/admin).
  pgPolicy('companies_write_admins', {
    for: 'all', to: authenticatedRole,
    using: sql`${t.id} in (
      select company_id from company_members
      where user_id = ${authUid} and role in ('owner','admin')
    )`,
    withCheck: sql`${t.id} in (
      select company_id from company_members
      where user_id = ${authUid} and role in ('owner','admin')
    )`,
  }),
]);

// profiles — id (= auth.users.id), full_name, action_pin_hash (Phase 5), created_at
export const profiles = pgTable('profiles', {
  id:            uuid('id').primaryKey(),          // == auth.users.id
  fullName:      text('full_name'),
  actionPinHash: text('action_pin_hash'),          // nullable until Phase 5
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // A user can read/update only their own profile row.
  pgPolicy('profiles_select_self', {
    for: 'select', to: authenticatedRole, using: sql`${t.id} = ${authUid}`,
  }),
  pgPolicy('profiles_update_self', {
    for: 'update', to: authenticatedRole,
    using: sql`${t.id} = ${authUid}`, withCheck: sql`${t.id} = ${authUid}`,
  }),
]);

// company_members — the tenancy join + per-company role. This drives RLS everywhere.
export const companyMembers = pgTable('company_members', {
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').notNull().references(() => profiles.id,   { onDelete: 'cascade' }),
  role:      companyRole('role').notNull().default('viewer'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.companyId, t.userId] }),
  // A user can see membership rows of companies they belong to.
  pgPolicy('members_select_own_companies', {
    for: 'select', to: authenticatedRole,
    using: sql`${t.companyId} in (
      select company_id from company_members where user_id = ${authUid}
    )`,
  }),
  // Only owners/admins of a company can add/modify members.
  pgPolicy('members_write_admins', {
    for: 'all', to: authenticatedRole,
    using: sql`${t.companyId} in (
      select company_id from company_members
      where user_id = ${authUid} and role in ('owner','admin')
    )`,
    withCheck: sql`${t.companyId} in (
      select company_id from company_members
      where user_id = ${authUid} and role in ('owner','admin')
    )`,
  }),
]);
```

> **Recursion caveat to verify at migration time:** the `company_members` policies reference `company_members` in their own subquery. Supabase's standard team/tenant RLS example does exactly this and it works, but if Postgres raises infinite-recursion on the self-referential policy, the documented fix is a `SECURITY DEFINER` helper function (e.g. `is_company_member(company_id)`) called from the policy. I'll confirm against the live DB during step 15 and adjust if needed rather than assume.

**How the RLS-aware client enforces it** (the load-bearing piece — without it RLS is a silent no-op because the pooler login role bypasses RLS):

```ts
// src/lib/db/client.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';

const cfg = { casing: 'snake_case', schema } as const;
// Bypasses RLS — DIRECT/admin url, connects as postgres. Trusted server use only.
export const adminDb  = drizzle({ client: postgres(process.env.ADMIN_DATABASE_URL!, { prepare: false }), ...cfg });
// Enforces RLS — transaction pooler (:6543). prepare:false is REQUIRED.
export const rlsClient = drizzle({ client: postgres(process.env.DATABASE_URL!, { prepare: false }), ...cfg });
```

```ts
// src/lib/db/rls.ts  — wrap every user query in a tx that injects the JWT claims + role
import { sql } from 'drizzle-orm';
import { jwtDecode } from 'jose';            // or decodeJwt from 'jose'
import { rlsClient, adminDb } from './client';
import { createClient } from '@/lib/supabase/server';

export async function getDb() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ? jwtDecode<{ sub?: string; role?: string }>(session.access_token) : {};
  return {
    admin: adminDb,
    rls: <T>(run: (tx: typeof rlsClient) => Promise<T>) =>
      rlsClient.transaction(async (tx) => {
        await tx.execute(sql`
          select set_config('request.jwt.claims', ${JSON.stringify(token)}, true);
          select set_config('request.jwt.claim.sub', ${token.sub ?? ''}, true);
          set local role ${sql.raw(token.role ?? 'anon')};
        `);
        try { return await run(tx); }
        finally { await tx.execute(sql`select set_config('request.jwt.claims', null, true); reset role;`); }
      }),
  };
}
```
Usage in a Server Action: `const db = await getDb(); await db.rls(tx => tx.select().from(companies))` for user-scoped reads; `db.admin...` only for trusted bootstrap (e.g. seeding members). Even without a `WHERE`, RLS hides other tenants' rows.

---

## 5. Supabase Auth wiring

Exactly the `@supabase/ssr` 0.12 pattern. Key Next-16 facts: `cookies()` is **async** (server client must be `async`), cookie handlers are **`getAll`/`setAll` only**, and the root file is **`proxy.ts`** exporting **`proxy`** (not `middleware`).

- **`src/lib/supabase/client.ts`** — `createBrowserClient(URL, PUBLISHABLE_KEY)`, synchronous.
- **`src/lib/supabase/server.ts`** — `async createClient()` → `await cookies()` → `createServerClient` with `getAll`/`setAll` (setAll wrapped in try/catch so Server Components don't throw; safe because the proxy refreshes sessions).
- **`src/lib/supabase/proxy.ts`** — `updateSession(request)`: build server client bound to req/res cookies, then **immediately** `await supabase.auth.getClaims()` (no code between — random-logout footgun), redirect unauthenticated users to `/login`, and **return the exact `supabaseResponse`** (copy cookies if you make a new response).
- **`proxy.ts`** (root) — `export async function proxy(req) { return updateSession(req) }` + matcher excluding `_next/*`, favicon, images.

**Login Server Action** (`src/app/(auth)/login/actions.ts`):
```ts
'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  });
  if (error) redirect('/login?error=1');
  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
```

**How a Server Action reads role for RBAC** (`src/lib/auth/rbac.ts`) — this is the app-layer half of the two-layer model:
```ts
'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/rls';
import { companyMembers } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';

type Role = 'owner'|'admin'|'accountant'|'encoder'|'viewer';

export async function requireRole(allowed: Role[]) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();   // verifies JWT (local for asymmetric keys)
  if (error || !data?.claims) redirect('/login');
  const userId = data.claims.sub as string;

  const companyId = (await cookies()).get('active_company')?.value;
  if (!companyId) redirect('/dashboard');                    // no company selected

  const db = await getDb();
  const [m] = await db.rls(tx =>
    tx.select().from(companyMembers)
      .where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId))));

  if (!m || !allowed.includes(m.role as Role)) throw new Error('Forbidden');  // RBAC gate
  return { userId, companyId, role: m.role as Role };
}
```
Every future mutation begins with `await requireRole([...])`; RLS independently enforces the same boundary at the database even if this check is skipped.

---

## 6. Tailwind v4 + shadcn theme

CSS-first (no `tailwind.config.js`). Brand RAW values live in `:root`/`.dark`; the token→variable mapping lives in `@theme inline` so every shadcn component (and sidebar-07) inherits the palette without touching component files. oklch values from the research are direct sRGB→OKLCH conversions of `#0F766E` / `#1F2937`.

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);      --color-foreground: var(--foreground);
  --color-primary: var(--primary);            --color-primary-foreground: var(--primary-foreground);
  --color-card: var(--card);                  --color-card-foreground: var(--card-foreground);
  --color-muted: var(--muted);                --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);              --color-accent-foreground: var(--accent-foreground);
  --color-border: var(--border);              --color-input: var(--input);  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);            --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);  --color-sidebar-ring: var(--sidebar-ring);
  --radius-sm: calc(var(--radius) - 4px);     --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);                 --radius-xl: calc(var(--radius) + 4px);
  /* (+ popover, secondary, destructive, chart-1..5 — full set per shadcn output) */
}

:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.2781 0.0296 256.848);          /* charcoal #1F2937 text */
  --primary: oklch(0.5109 0.0861 186.391);             /* BRAND teal #0F766E */
  --primary-foreground: oklch(0.985 0 0);              /* near-white on teal */
  --muted: oklch(0.97 0 0);  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0); --accent-foreground: oklch(0.2781 0.0296 256.848);
  --border: oklch(0.922 0 0); --input: oklch(0.922 0 0);
  --ring: oklch(0.5109 0.0861 186.391);                /* teal focus ring */
  /* Sidebar = charcoal surface, teal active item */
  --sidebar: oklch(0.2781 0.0296 256.848);             /* charcoal #1F2937 */
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.5109 0.0861 186.391);     /* teal active */
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.34 0.03 256);              /* hover */
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(1 0 0 / 10%);  --sidebar-ring: oklch(0.5109 0.0861 186.391);
}

.dark {
  --background: oklch(0.2781 0.0296 256.848);           /* charcoal base */
  --foreground: oklch(0.985 0 0);
  --primary: oklch(0.7038 0.123 182.503);              /* brighter teal on dark */
  --primary-foreground: oklch(0.2 0.02 256);
  --border: oklch(1 0 0 / 10%);  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.7038 0.123 182.503);
  --sidebar: oklch(0.205 0 0);  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.7038 0.123 182.503);
  --sidebar-primary-foreground: oklch(0.2 0.02 256);
  /* (+ remaining dark tokens per shadcn output) */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
```

**App-shell components** (from `sidebar-07`): `app-sidebar.tsx` (collapsible `<Sidebar>` with company switcher in `<SidebarHeader>`, `nav-main`, `nav-user` in footer), wrapped by `src/app/(app)/layout.tsx` in `<SidebarProvider>` + `<SidebarInset>` with a sticky top bar (`<SidebarTrigger/>`, breadcrumb, user menu). `team-switcher.tsx` is renamed `company-switcher.tsx` and fed the user's `company_members` rows; selecting a company calls `setActiveCompany` which writes an httpOnly `active_company` cookie and `revalidatePath('/', 'layout')`.

---

## 7. Env vars

| Name | Scope | Purpose | Where set |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (browser + server clients) | Vercel: Prod+Preview+Dev; `.env.local` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | `sb_publishable_…` browser key (safe **only** with RLS on) | Vercel: Prod+Preview+Dev; `.env.local` |
| `SUPABASE_SECRET_KEY` | Server-only **(Sensitive)** | `sb_secret_…`; bypasses RLS; server-only (admin tasks, Vault) | Vercel: Prod+Preview; `.env.local` |
| `DATABASE_URL` | Server-only **(Sensitive)** | Supavisor **transaction** pooler `:6543` — runtime queries (`prepare:false`) | Vercel: Prod+Preview; `.env.local` |
| `ADMIN_DATABASE_URL` / `DIRECT_URL` | Server-only **(Sensitive)** | Direct `:5432` (or session pooler) — migrations + RLS-bypass admin client | Vercel: Prod+Preview (if migrating from Vercel); CI/local |

Notes: `NEXT_PUBLIC_*` are inlined at **build** time (cannot be Sensitive; changing them needs a redeploy). Sensitive vars are write-only after creation — store the source of truth in a password manager. Use the new **publishable/secret** keys (legacy anon/service_role removed for new projects since Nov 2025). `vercel env pull` hydrates `.env.local`; never commit it.

> One naming reconciliation: research files use both `DIRECT_URL` (env section) and `ADMIN_DATABASE_URL` (RLS-wrapper section) for the `:5432` string. They are the **same connection string**. Recommend standardizing on **`ADMIN_DATABASE_URL`** for the admin client and migrations, and dropping `DIRECT_URL` to avoid two names for one value. Confirm in §9.

**`.env.example` stub:**
```bash
# ---- PUBLIC (browser; inlined at build; never secrets) ----
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxxxxxxxxxx

# ---- SERVER-ONLY (never NEXT_PUBLIC_, mark Sensitive in Vercel) ----
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxx
# Runtime queries -> transaction pooler :6543  (use { prepare: false })
DATABASE_URL=postgres://postgres.<ref>:<DB_PASSWORD>@aws-<region>.pooler.supabase.com:6543/postgres
# Migrations + RLS-bypass admin client -> direct :5432 (IPv4-only? use session pooler :5432)
ADMIN_DATABASE_URL=postgresql://postgres:<DB_PASSWORD>@db.<ref>.supabase.co:5432/postgres
```

---

## 8. Acceptance criteria (Phase 0 "done when")

- [ ] App is scaffolded on **Next 16.2.9 / React 19.2.7 / Node 20+**, pinned to the May-2026-patched versions; `npm run build` passes.
- [ ] **Supabase project provisioned**; Drizzle migration created `companies`, `profiles`, `company_members` with **RLS enabled and policies applied** (verified via `generate`+`migrate`, confirmed in DB).
- [ ] A user can **log in** with email/password; the session is stored in **httpOnly cookies** (not localStorage); the proxy refreshes it.
- [ ] After login the user **lands on an empty dashboard**; unauthenticated access to `(app)` routes redirects to `/login` (proxy **and** per-page `getClaims()` — two-layer gate).
- [ ] The user can **switch between companies** (switcher fed by their `company_members`; selection persists via httpOnly `active_company` cookie); data is isolated per company by RLS.
- [ ] Theme renders **teal `#0F766E` / charcoal `#1F2937`** across the shell (sidebar + top bar + dashboard).
- [ ] App is **live on Vercel** via Git integration (Production + Preview), with per-environment secrets and **no secret in the client bundle** (`SUPABASE_SECRET_KEY`, `DATABASE_URL`, `ADMIN_DATABASE_URL` absent from `_next/static`).
- [ ] RLS-aware DB wrapper (`.rls()`) is in place and a sanity query returns only the active company's rows.

*(Note: the PROJECT_PLAN names Phase 0 "CI/CD"; the stated "done when" only requires Vercel Git deploy. I scope Phase 0 to Git-integration deploy and leave a formal test/CI pipeline to a later phase unless you want it now — see §9.)*

---

## 9. Open sub-decisions to confirm before building

1. **Provisioning method — Supabase + Vercel.** I have MCP tools for both (`Supabase__create_project`, `apply_migration`; `Vercel__deploy_to_vercel`). **Recommendation: I provision via MCP** (faster, fewer copy-paste key errors) **but you hold the dashboard owner account and the DB password**, and I hand back the keys for you to store. Alternative: you create both projects manually and paste me the URL + keys. Confirm which.
2. **Login method.** Email/password vs magic-link. **Recommendation: email/password for Phase 0** (matches the research snippets, simplest, no email-deliverability dependency for an internal tool). Magic-link/SSO can come in Phase 5. Confirm.
3. **Migration connection string.** Run `drizzle-kit migrate` over the **direct `:5432`** by default; **fall back to the session pooler `:5432`** if your machine/CI is IPv4-only (the direct endpoint is IPv6-only without the add-on). **Recommendation: try direct, keep session-pooler string ready.** Also confirm we standardize the env name as **`ADMIN_DATABASE_URL`** (drop `DIRECT_URL`).
4. **Seed the 3 companies now?** Vault Master, Smart Haven, Saglit Resorts. **Recommendation: yes — seed all three plus your owner `profile` + `company_members` rows** (via the admin client / a one-off migration), so the company switcher has real data to switch between for the acceptance test. Without seeding, "switch companies" can't be demonstrated. Confirm the exact legal names/slugs.
5. **Drizzle version line.** **Recommendation: pin stable `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10`** (not the non-existent "7.x", not the 1.0 beta/rc). I'll also update `CLAUDE.md`/`PROJECT_PLAN.md` wording. Confirm you're OK on the stable line vs deliberately opting into `1.0.0-rc`.
6. **Zod 4.** Live latest is **Zod `4.4.3`**. Phase 0 barely uses Zod, but Phase 1+ leans on it heavily. **Recommendation: adopt Zod 4 now.** Confirm (vs pinning v3 for older snippet compatibility).
7. **RLS wrapper scope in Phase 0.** The `.rls()` transaction wrapper + `jose` are only strictly needed once we read tenant data in app code. **Recommendation: build it now** (it's the load-bearing security primitive and the company switcher needs it). Alternative: defer to Phase 1 and use the admin client for the Phase 0 switcher only. Confirm.
8. **CI pipeline.** PROJECT_PLAN mentions "CI/CD"; the "done when" only requires Vercel deploy. **Recommendation: Phase 0 = Vercel Git integration only; add a GitHub Actions lint/build/typecheck + `drizzle-kit` check in Phase 1.** Confirm.
9. **`cacheComponents: true` now or later.** Enabling it makes everything dynamic-by-default and changes navigation (`<Activity>` keeps components mounted). **Recommendation: enable now** so we build on the final model from day one, but be aware the sidebar/dropdown mount behavior differs. Alternative: leave off until Phase 3 caching work. Confirm.

---

## 10. Risks / gotchas (top version-specific traps)

1. **"Drizzle 7.x" does not exist.** Building against an imagined 7.x API will fail. Pin `drizzle-orm@0.45.2` / `drizzle-kit@0.31.10`. (Verified live.)
2. **RLS is a silent no-op without the `.rls()` transaction wrapper.** `set_config(...,true)` and `set local role` are transaction-scoped; a plain `drizzle()` query runs as the pooler login role (which can bypass RLS) and **leaks cross-tenant rows with no error**. The wrapper is mandatory, not optional.
3. **`{ prepare: false }` is mandatory** on the `:6543` transaction pooler (no prepared statements) — the #1 Supabase+Drizzle footgun on Vercel.
4. **Migrations must run over `:5432` (direct/session), never `:6543`.** Running DDL through the transaction pooler causes "prepared statement already exists" and mis-handled DDL. Direct `:5432` is **IPv6-only** without the add-on → use session pooler `:5432` from IPv4 CI.
5. **`crudPolicy` is Neon-only.** Importing it from `drizzle-orm/supabase` fails. Use raw `pgPolicy` + `drizzle-orm/supabase` role helpers. Also add `entities.roles.provider:'supabase'` in `drizzle.config.ts` or drizzle-kit will try to CREATE/DROP Supabase's built-in roles and break the migration. Use `generate`+`migrate`, **not `push`** (push has a known RLS-apply caveat, issue #3504).
6. **Next 16: `middleware.ts` → `proxy.ts`** (export renamed to `proxy`, runs on Node runtime). The session-refresh file at the root must be `proxy.ts` or auth won't refresh.
7. **Next 16: `cookies()`/`headers()`/`params`/`searchParams` are async-only** (sync shim removed). The server Supabase client **must be `async` and `await cookies()`**, or it throws.
8. **Supabase proxy ordering footgun:** put **nothing** between `createServerClient(...)` and `getClaims()`/`getUser()`, and **return the exact `supabaseResponse`** (copy cookies if you build a new response) — otherwise users get randomly logged out.
9. **Publishable key is only safe with RLS on.** Any table without RLS is wide-open to anyone holding `sb_publishable_…`. Verify RLS is enabled on all three Phase 0 tables before exposing the key. The `sb_secret_…` key bypasses RLS and is rejected in browsers — never `NEXT_PUBLIC_` it.
10. **React pinned canary vs declared version + `getClaims` keys.** App Router runs an internal React canary (why 19.2 features work), but you still declare `react@19.2.7`. Separately, `getClaims()` verifies JWTs locally only with **asymmetric/JWT signing keys** (the default for new projects) — confirm the project uses them, else `getClaims` makes a network call; never trust `getSession()`'s user for authz.
11. **Tailwind v4 has no `tailwind.config.js`** and `components.json` must have `tailwind.config: ""`. Use `@tailwindcss/postcss` (not `tailwindcss`) in PostCSS; keep the `tw-animate-css` import or dialogs/dropdowns/sidebar animations break. v4 needs Chrome 111+/Safari 16.4+/Firefox 128+.
12. **`company_members` self-referential RLS** may trip Postgres infinite-recursion; if so, switch the predicate to a `SECURITY DEFINER` `is_company_member()` helper. To be verified at migration time (step 15), not assumed.

Relevant files already in the repo: `C:\Users\chi\OneDrive\Desktop\My Claude Projects\Aven\aven-erp\CLAUDE.md` and `C:\Users\chi\OneDrive\Desktop\My Claude Projects\Aven\aven-erp\docs\PROJECT_PLAN.md` (decisions confirmed 2026-06-20: roles owner/admin/accountant/encoder/viewer, ₱10,000 PIN threshold, three companies, greenfield with Google-Sheets-compatible headers). The "Drizzle ORM 7.x" wording in both should be corrected to the stable 0.45/0.31 line.

---

## Sources (web-verified 2026-06-20)

- [Next.js 16 (official release blog) - Cache Components, Turbopack default, breaking changes, version requirements](https://nextjs.org/blog/next-16)
- [Turbopack: What's New in Next.js 16.2 (official blog, March 18 2026)](https://nextjs.org/blog/next-16-2-turbopack)
- [Installation (official docs, version 16.2.9) - create-next-app command, prompts/flags, defaults, Node/TS requirements](https://nextjs.org/docs/app/getting-started/installation)
- [create-next-app CLI reference (flags)](https://nextjs.org/docs/app/api-reference/cli/create-next-app)
- [cacheComponents config (official docs, version 16.2.9) - how to opt in, PPR-by-default, Activity navigation](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
- [use cache directive (official docs, version 16.2.9) - file/component/function usage, constraints](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [Mutating Data / Server Actions (official docs, version 16.2.9) - 'use server', forms, revalidate, refresh](https://nextjs.org/docs/app/getting-started/mutating-data)
- [Upgrading: Version 16 (official migration guide)](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [React Security Advisory GHSA-rv78-f8rc-xrxh / CVE-2026-23870 (May 6 2026) - patched 19.0.6 / 19.1.7 / 19.2.6](https://github.com/facebook/react/security/advisories/GHSA-rv78-f8rc-xrxh)
- [React blog: Denial of Service and Source Code Exposure in React Server Components (Dec 2025, series context)](https://react.dev/blog/2025/12/11/denial-of-service-and-source-code-exposure-in-react-server-components)
- [Vercel changelog: Next.js May 2026 security release - affected through 16.2.5, upgrade to 16.2.6+](https://vercel.com/changelog/next-js-may-2026-security-release)
- [next on npm (version history) - latest 16.2.9](https://www.npmjs.com/package/next?activeTab=versions)
- [Drizzle ORM - Row-Level Security (RLS): pgPolicy/pgRole options, drizzle-orm/supabase roles (authenticatedRole, authUid), entities.roles provider:'supabase', crudPolicy is Neon-only](https://orm.drizzle.team/docs/rls)
- [Drizzle ORM - Connect to Supabase: postgres-js driver, prepare:false for transaction pooler, pooler vs direct connection](https://orm.drizzle.team/docs/connect-supabase)
- [Drizzle ORM - Tutorial: Drizzle with Supabase Database (schema, drizzle.config.ts, generate/migrate)](https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase)
- [rphlmr/drizzle-supabase-rls - reference RLS-aware client (createDrizzle/.rls, set_config request.jwt.claims, SET LOCAL ROLE, admin vs rls client)](https://github.com/rphlmr/drizzle-supabase-rls)
- [Supabase Docs - Connect to your database (direct :5432 vs Supavisor session :5432 vs transaction :6543; transaction mode has no prepared statements)](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase Docs - Row Level Security: auth.uid()/auth.jwt(), (select auth.uid()) perf wrap, TO authenticated, team/tenant policy example, app_metadata vs user_metadata for authz](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Troubleshooting - Supavisor & connection terminology (port 6543 transaction vs 5432 session, IPv4)](https://supabase.com/docs/guides/troubleshooting/supavisor-and-connection-terminology-explained-9pr_ZO)
- [Drizzle ORM v1.0.0-beta release notes (1.0 still in beta/RC mid-2026)](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v1beta2)
- [drizzle-kit push vs migrate RLS apply caveat (issue #3504)](https://github.com/drizzle-team/drizzle-orm/issues/3504)
- [A Practical Guide to Managing Drizzle ORM and Supabase RLS in a Monorepo (multi-tenant tenant_members pgPolicy pattern)](https://zenn.dev/azuma317/articles/drizzle-supabase-rls-monorepo?locale=en)
- [Setting up Server-Side Auth for Next.js | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [AI Prompt: Bootstrap Next.js v16 app with Supabase Auth | Supabase Docs (verbatim source of client/server/proxy code)](https://supabase.com/docs/guides/getting-started/ai-prompts/nextjs-supabase-auth)
- [Creating a Supabase client for SSR | Supabase Docs](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Server-Side Rendering (getClaims vs getUser vs getSession) | Supabase Docs](https://supabase.com/docs/guides/auth/server-side)
- [Migrating to the SSR package from Auth Helpers | Supabase Docs](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)
- [Functions: cookies (async in Next 16) | Next.js](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [npm: @supabase/ssr (0.12.0)](https://registry.npmjs.org/@supabase/ssr/latest)
- [npm: next (16.2.9)](https://registry.npmjs.org/next/latest)
- [Tailwind CSS — Install with Next.js (official framework guide)](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Tailwind CSS — Using PostCSS (install)](https://tailwindcss.com/docs/installation/using-postcss)
- [Tailwind CSS v4 Upgrade Guide (breaking changes vs v3)](https://tailwindcss.com/docs/upgrade-guide)
- [shadcn/ui — Next.js installation](https://ui.shadcn.com/docs/installation/next)
- [shadcn/ui — Theming (CSS variables, @theme inline, oklch)](https://ui.shadcn.com/docs/theming)
- [shadcn/ui — components.json reference](https://ui.shadcn.com/docs/components-json)
- [shadcn/ui — Manual installation (full default globals.css)](https://ui.shadcn.com/docs/installation/manual)
- [shadcn/ui — Sidebar blocks (sidebar-07 / team-switcher app shell)](https://ui.shadcn.com/blocks/sidebar)
- [Tailwind CSS v4.3 release notes](https://tailwindcss.com/blog/tailwindcss-v4-3)
- [tailwindcss on npm (version check)](https://www.npmjs.com/package/tailwindcss)
- [Supabase - Migrating to publishable and secret API keys](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys)
- [Supabase - Understanding API keys (publishable vs secret, browser safety, RLS)](https://supabase.com/docs/guides/api/api-keys)
- [Supabase changelog/discussion - Upcoming changes to Supabase API Keys (timeline)](https://github.com/orgs/supabase/discussions/29260)
- [Supabase - Disabling prepared statements (Drizzle prepare:false, Prisma pgbouncer=true)](https://supabase.com/docs/guides/troubleshooting/disabling-prepared-statements-qL8lEL)
- [Supabase - Connecting with Drizzle (DATABASE_URL pooler, prepare:false)](https://supabase.com/docs/guides/database/drizzle)
- [Drizzle - Get Started with Drizzle and Supabase](https://orm.drizzle.team/docs/get-started/supabase-new)
- [Supabase - Vault (encrypted secrets, vault.create_secret, decrypted_secrets)](https://supabase.com/docs/guides/database/vault)
- [Vercel - Environment variables (environments, 64KB limit, NEXT_PUBLIC, vercel env pull)](https://vercel.com/docs/environment-variables)
- [Vercel - Sensitive environment variables (write-only, encrypted, Production/Preview only)](https://vercel.com/docs/environment-variables/sensitive-environment-variables)
- [Vercel - Manage environment variables across environments (vercel env ls / --sensitive)](https://vercel.com/docs/environment-variables/manage-across-environments)
- [Vercel - Next.js on Vercel (Git integration, preview vs production deploys)](https://vercel.com/docs/frameworks/full-stack/nextjs)
