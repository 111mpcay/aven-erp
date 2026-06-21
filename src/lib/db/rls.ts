import "server-only";

import { sql } from "drizzle-orm";

import { createClient } from "@/lib/supabase/server";
import { getAdminDb, getRlsClient } from "./client";

type RlsTx = Parameters<
  Parameters<ReturnType<typeof getRlsClient>["transaction"]>[0]
>[0];

/**
 * getDb() returns the two ways to reach the database:
 *
 *  - `admin`  — RLS-BYPASS client. Trusted server tasks only (bootstrap/seed).
 *  - `rls(fn)` — runs `fn` inside a transaction as the `authenticated` role with
 *    the user's verified JWT claims injected, so Postgres RLS enforces. Use this
 *    for ALL user-scoped reads/writes. With no authenticated user, queries run as
 *    `anon` and RLS returns nothing.
 *
 * Both SET LOCAL settings are transaction-scoped, so they auto-clear when the
 * (transaction-pooled) connection is returned.
 */
export async function getDb() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = (data?.claims ?? null) as { sub?: string; role?: string } | null;
  // Allow-list the role: never let a token claim downgrade us into a BYPASSRLS
  // role (service_role/postgres). Only 'authenticated' or fail-closed 'anon'.
  const role = claims?.role === "authenticated" ? "authenticated" : "anon";

  return {
    admin: getAdminDb(),
    rls: <T>(run: (tx: RlsTx) => Promise<T>): Promise<T> =>
      getRlsClient().transaction(async (tx) => {
        await tx.execute(sql`
          select
            set_config('request.jwt.claims', ${claims ? JSON.stringify(claims) : "{}"}, true),
            set_config('role', ${role}, true)
        `);
        return run(tx);
      }),
  };
}
