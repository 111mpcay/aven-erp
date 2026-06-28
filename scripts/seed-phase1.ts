/**
 * Phase 1 seed — default cash accounts + chart-of-accounts-lite categories for
 * every existing company. Idempotent: re-running inserts nothing new (relies on
 * the unique keys cash_accounts(company_id,name) and categories(company_id,code)
 * via onConflictDoNothing).
 *
 * Run with:  npm run db:seed
 * Uses the RLS-BYPASS admin client (system task), so it writes across all
 * companies regardless of who runs it. Never import this from app code.
 */
import { adminClient, adminDb } from "./db";
import { cashAccounts, categories, companies } from "../src/lib/db/schema";

const DEFAULT_ACCOUNTS: { name: string; type: "bank" | "ewallet" | "cash" }[] = [
  { name: "Cash on Hand", type: "cash" },
  { name: "GCash", type: "ewallet" },
  { name: "Maya", type: "ewallet" },
  { name: "BPI", type: "bank" },
];

const DEFAULT_CATEGORIES: {
  code: string;
  name: string;
  kind: "income" | "cogs" | "expense";
}[] = [
  { code: "4000", name: "Sales", kind: "income" },
  { code: "4900", name: "Other Income", kind: "income" },
  { code: "5000", name: "Cost of Goods Sold", kind: "cogs" },
  { code: "6000", name: "Advertising & Marketing", kind: "expense" },
  { code: "6010", name: "Meta Ads", kind: "expense" },
  { code: "6100", name: "Salaries & Wages", kind: "expense" },
  { code: "6200", name: "Rent", kind: "expense" },
  { code: "6300", name: "Utilities", kind: "expense" },
  { code: "6400", name: "Supplies", kind: "expense" },
  { code: "6500", name: "Shipping & Delivery", kind: "expense" },
  { code: "6600", name: "Transportation", kind: "expense" },
  { code: "6700", name: "Professional Fees", kind: "expense" },
  { code: "6800", name: "Bank & Payment Fees", kind: "expense" },
  { code: "6900", name: "Taxes & Licenses", kind: "expense" },
  { code: "7000", name: "Repairs & Maintenance", kind: "expense" },
  { code: "7900", name: "Miscellaneous", kind: "expense" },
];

async function main() {
  const db = adminDb;

  const allCompanies = await db
    .select({ id: companies.id, name: companies.name })
    .from(companies);

  if (allCompanies.length === 0) {
    console.warn(
      "No companies found. Seed the companies/company_members first (Phase 0), then re-run.",
    );
    return;
  }

  for (const company of allCompanies) {
    await db
      .insert(cashAccounts)
      .values(
        DEFAULT_ACCOUNTS.map((a) => ({
          companyId: company.id,
          name: a.name,
          type: a.type,
          openingBalance: "0",
          currency: "PHP",
        })),
      )
      .onConflictDoNothing({
        target: [cashAccounts.companyId, cashAccounts.name],
      });

    await db
      .insert(categories)
      .values(
        DEFAULT_CATEGORIES.map((c) => ({
          companyId: company.id,
          code: c.code,
          name: c.name,
          kind: c.kind,
        })),
      )
      .onConflictDoNothing({ target: [categories.companyId, categories.code] });

    console.log(
      `Seeded defaults for "${company.name}" (${DEFAULT_ACCOUNTS.length} accounts, ${DEFAULT_CATEGORIES.length} categories).`,
    );
  }

  console.log(`Done. Processed ${allCompanies.length} company(ies).`);
}

main()
  .then(async () => {
    await adminClient.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Seed failed:", err);
    await adminClient.end();
    process.exit(1);
  });
