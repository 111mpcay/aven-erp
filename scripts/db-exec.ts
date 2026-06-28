/**
 * Execute a .sql file over the admin connection. Used to apply version-
 * controlled SQL that isn't part of the Drizzle migration chain (e.g. Storage
 * policies in the `storage` schema).
 *
 *   tsx scripts/db-exec.ts scripts/storage-receipts.sql
 */
import { readFileSync } from "node:fs";

import { adminClient } from "./db";

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: tsx scripts/db-exec.ts <file.sql>");
    process.exit(1);
  }
  const sqlText = readFileSync(file, "utf8");
  // Multi-statement string runs via the simple query protocol (no params).
  await adminClient.unsafe(sqlText);
  console.log(`Executed ${file}`);
}

main()
  .then(async () => {
    await adminClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Failed:", err);
    await adminClient.end();
    process.exit(1);
  });
