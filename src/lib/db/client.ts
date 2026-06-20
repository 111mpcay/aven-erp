import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const drizzleOptions = { casing: "snake_case" as const, schema };

/**
 * adminDb — connects as `postgres` and BYPASSES RLS. Trusted server-side use
 * ONLY (bootstrap, seeding, admin tasks). Never expose its results to a user
 * without an explicit authorization check. Session pooler (5432).
 */
export const adminDb = drizzle({
  client: postgres(process.env.ADMIN_DATABASE_URL!, { prepare: false }),
  ...drizzleOptions,
});

/**
 * rlsClient — the base RLS-aware client over the transaction pooler (6543).
 * `prepare: false` is REQUIRED on the transaction pooler.
 *
 * Do NOT query this directly: it logs in as `postgres`, which bypasses RLS.
 * Always go through `getDb().rls(tx => ...)` (lib/db/rls.ts), which wraps each
 * query in a transaction that does `set local role authenticated` + injects the
 * user's JWT claims so the database enforces row-level security.
 */
export const rlsClient = drizzle({
  client: postgres(process.env.DATABASE_URL!, { prepare: false }),
  ...drizzleOptions,
});
