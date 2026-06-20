import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const drizzleOptions = { casing: "snake_case" as const, schema };

let adminInstance: ReturnType<typeof createAdmin> | undefined;
let rlsInstance: ReturnType<typeof createRls> | undefined;

function createAdmin() {
  // Connects as `postgres` and BYPASSES RLS. Session pooler (5432).
  return drizzle({
    client: postgres(process.env.ADMIN_DATABASE_URL!, { prepare: false }),
    ...drizzleOptions,
  });
}

function createRls() {
  // Transaction pooler (6543); prepare:false is REQUIRED there.
  return drizzle({
    client: postgres(process.env.DATABASE_URL!, { prepare: false }),
    ...drizzleOptions,
  });
}

/**
 * RLS-BYPASS admin client. Trusted server-side use ONLY (bootstrap, seeding).
 * Lazy + memoized so importing this module never opens a connection (safe at
 * build time / before env is configured).
 */
export function getAdminDb() {
  return (adminInstance ??= createAdmin());
}

/**
 * Base RLS-aware client. Do NOT use directly — it logs in as `postgres` and
 * bypasses RLS. Always go through getDb().rls() (lib/db/rls.ts), which sets
 * role=authenticated + injects JWT claims per transaction so RLS enforces.
 */
export function getRlsClient() {
  return (rlsInstance ??= createRls());
}
