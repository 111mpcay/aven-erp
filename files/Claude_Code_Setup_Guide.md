# Claude Code Setup & Workflow Guide — Cashflow & Accounting System

How to drop these files into a repo and drive Claude Code to build this cleanly, one phase at a time.
Verified against current Claude Code behavior (June 2026).

---

## 1. File layout

```
your-repo/
├── CLAUDE.md                  # auto-loaded EVERY session — the instruction file
├── docs/
│   └── PROJECT_PLAN.md        # the full plan (architecture, data model, phases)
├── .claude/
│   ├── commands/              # custom slash commands (recommended)
│   │   ├── start-phase.md
│   │   ├── ship-check.md
│   │   └── security-review.md
│   └── settings.json          # project settings (optional)
├── .env.local                 # secrets — NEVER commit
└── .gitignore
```

- **`CLAUDE.md`** → repo root. Claude Code reads it automatically at the start of every session.
- **`docs/PROJECT_PLAN.md`** → this is the plan I already gave you
  (`Cashflow_Accounting_System_Plan.md`). **Rename it to `PROJECT_PLAN.md` and put it in `docs/`.**
  CLAUDE.md tells Claude to read it before each phase, so it's consulted without bloating every session.

---

## 2. Install & start

```bash
# Native installer (recommended)
curl -fsSL https://claude.ai/install.sh | bash
claude --version          # verify

# Start a session inside your project
cd your-repo
claude
```

You can also `brew install --cask claude-code`. (The npm package is being deprecated in favor of the
native binary.) You **don't** need `/init` — a hand-written `CLAUDE.md` beats a generated one. If you
ever want it refreshed after big changes, `/init` regenerates and `/memory` opens it for editing.

---

## 3. How Claude Code's memory works (so you trust it)

- `CLAUDE.md` at the repo root loads into context at the **start of every session** (Claude reads up
  the directory tree from your current folder), and it **survives auto-compaction** — the rules stay
  in force through long sessions.
- The big plan (`docs/PROJECT_PLAN.md`) is **not** auto-loaded. CLAUDE.md instructs Claude to read it
  when starting a phase — lean sessions, plan still consulted. _(If you'd rather always load it, add
  `@docs/PROJECT_PLAN.md` to CLAUDE.md. For a plan this size, read-on-phase is the better default.)_
- `/memory` shows what's loaded and lets you edit it. Auto memory (Claude writing notes from your
  corrections) also exists; your written CLAUDE.md always wins.
- As the project grows, split topic rules into **`.claude/rules/`** (e.g. `security.md`,
  `conventions.md`) to keep the root file tight.

---

## 4. Custom slash commands (recommended)

Create these in `.claude/commands/`. Each becomes `/name`. _(In 2026, commands and skills were
unified, but `.claude/commands/` files still work exactly like this. `$ARGUMENTS` injects what you
type after the command.)_

**`.claude/commands/start-phase.md`**
```md
Read docs/PROJECT_PLAN.md and focus on: $ARGUMENTS.
First, confirm any unresolved decisions for this phase before coding.
Then enter Plan Mode and propose: the files you'll create/change, any new
tables/migrations, any new env vars, and the acceptance criteria from the
plan for this phase. Wait for my approval before writing any code.
```
Use: `/start-phase Phase 0` · `/start-phase Phase 1`

**`.claude/commands/ship-check.md`**
```md
Run the Definition of Done from CLAUDE.md against the current changes:
frontend + backend impact, no feature removed, RLS + RBAC + audit on every
new mutation, no exposed secrets, and new env vars/columns/migrations
called out. List anything missing, then run lint and the build.
```
Use: `/ship-check` before committing a phase.

**`.claude/commands/security-review.md`**
```md
Audit the current code against the Security rules in CLAUDE.md: secrets
server-side only, RLS on every table, two-layer authorization, PIN-gated
sensitive actions, Zod validation, audit_log on all mutations, httpOnly
sessions, and rate limiting. Report each gap with file and line number.
```
Use: `/security-review` at the end of each phase and before any deploy.

---

## 5. Recommended workflow

1. **Plan first.** For each phase, start in **Plan Mode** — press **Shift+Tab** to cycle to plan mode,
   or launch with `claude --permission-mode plan`. Let Claude read the plan and propose before it
   writes. Approve, then let it build.
2. **One phase per session.** Build a phase → `/ship-check` → `/security-review` → commit. Then
   `/clear` and start the next phase fresh. Keeps context clean and cheap.
3. **Use the right model.** Strong model for planning, fast model for bulk coding. If your install has
   an `opusplan`-style mode, it plans with the stronger model and writes with the faster one
   automatically. Check `/model` for what's available to you.
4. **Review every diff.** You're the senior reviewer — skim changes before approving writes. If it
   goes the wrong way, use `/rewind` (or double-Esc) instead of stacking correction prompts on a
   polluted context.
5. **Commit per phase.** A clean commit at each phase boundary gives you safe rollback points.

---

## 6. Exact kickoff prompts

**Step 1 — settle the open decisions** (paste, filling in your answers):
```
Before we scaffold, confirm the 7 items under "Current decisions" in CLAUDE.md.
My answers: 1) yes, multi-company  2) management-grade  3) yes, orders core
4) PHP + fx  5) Drizzle  6) roles fine, PIN threshold ₱____  7) greenfield.
Update CLAUDE.md to mark them confirmed, then stop.
```

**Step 2 — start Phase 0** (paste):
```
/start-phase Phase 0
```
This triggers: read the plan → confirm decisions → propose the scaffold (Next 16 + Tailwind v4 +
shadcn/ui + Supabase + Drizzle, auth, baseline RLS, `companies`/`profiles`/`company_members`,
teal/charcoal app shell, Vercel deploy) in Plan Mode. Approve and it builds.

---

## 7. Secrets & safety
- Put all keys in `.env.local` and Vercel/Supabase — **never commit them**. Add `.env*` to `.gitignore`.
- Integration tokens (Meta, etc.) live in **Supabase Vault**, not in code or client-exposed env.
- `CLAUDE.local.md` is **deprecated**; for personal (non-shared) preferences use `~/.claude/CLAUDE.md`
  or an `@~/.claude/...` import in CLAUDE.md.
- Commit `CLAUDE.md`, `docs/`, and `.claude/commands/` to source control so the whole team shares the
  same rules and workflow.
