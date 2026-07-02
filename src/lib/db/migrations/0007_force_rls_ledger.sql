-- Force RLS on ledger_entries so policies apply even to the table OWNER role.
-- Mirrors 0001/0003/0005 for earlier tables.
ALTER TABLE "ledger_entries" FORCE ROW LEVEL SECURITY;