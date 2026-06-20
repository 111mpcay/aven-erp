import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit is a standalone CLI; load Next's local env file explicitly.
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  casing: "snake_case",
  // Migrations run over the SESSION pooler (5432) / direct connection, NEVER the
  // transaction pooler (6543) — DDL + prepared statements misbehave there.
  dbCredentials: {
    url: process.env.ADMIN_DATABASE_URL!,
  },
  // Tell drizzle-kit the auth/anon/service_role roles are managed by Supabase,
  // so it won't try to CREATE/DROP them in migrations.
  entities: {
    roles: {
      provider: "supabase",
    },
  },
});
