-- Force RLS on the Phase 1 tables so policies apply even to the table OWNER
-- role. The runtime connects as `postgres` (owner) and the .rls() wrapper
-- downgrades to `authenticated` per transaction; FORCE is the belt-and-
-- suspenders backstop so any path that skips the downgrade still can't bypass
-- RLS. Mirrors 0001_force_rls.sql for the Phase 0 tenancy tables.
ALTER TABLE "cash_accounts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "categories" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "expenses" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;