/**
 * Standalone admin DB client for CLI scripts (seed, storage setup).
 *
 * Deliberately does NOT import src/lib/db/client.ts: that module is guarded with
 * `import "server-only"`, which throws under plain Node/tsx (Next aliases it away
 * at build via the react-server condition, but tsx cannot). We build the
 * RLS-bypass admin client directly from ADMIN_DATABASE_URL instead.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

if (!process.env.ADMIN_DATABASE_URL) {
  throw new Error("ADMIN_DATABASE_URL is not set (see .env.local / .env.example).");
}

// Session pooler (5432); RLS-bypass `postgres` role — system tasks only.
export const adminClient = postgres(process.env.ADMIN_DATABASE_URL, {
  prepare: false,
});

export const adminDb = drizzle({ client: adminClient, casing: "snake_case" });
