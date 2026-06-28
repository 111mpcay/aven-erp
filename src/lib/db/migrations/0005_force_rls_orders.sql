-- Force RLS on the Phase 2 tables so policies apply even to the table OWNER
-- role (the runtime connects as `postgres`; the .rls() wrapper downgrades to
-- `authenticated` per transaction). Mirrors 0001/0003 for earlier tables.
ALTER TABLE "orders" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY;