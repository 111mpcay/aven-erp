-- Force RLS so policies apply even to the table OWNER role.
-- The runtime connects as `postgres` (table owner) and the .rls() wrapper
-- downgrades to `authenticated` per transaction; FORCE is the belt-and-suspenders
-- backstop so any future path that skips the downgrade still can't bypass RLS.
ALTER TABLE "companies" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "company_members" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" FORCE ROW LEVEL SECURITY;
