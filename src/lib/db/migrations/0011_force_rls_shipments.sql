-- Force RLS on shipments so policies apply even to the table OWNER role.
-- Mirrors 0001/0003/0005/0007/0009 for earlier tables.
ALTER TABLE "shipments" FORCE ROW LEVEL SECURITY;