import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isAiEnabled } from "@/lib/ai";
import { getActiveCompany, requireAuth, WRITE_ROLES } from "@/lib/auth/rbac";
import { listCashAccounts, listCategories } from "@/lib/catalog";
import { listExpenses } from "@/lib/ledger";
import { ExpensesClient } from "./expenses-client";
import { ExpensesFilters } from "./expenses-filters";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const { active } = await getActiveCompany();

  if (!active) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any company yet. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(str(sp, "page") ?? "1") || 1);
  const filters = {
    dateFrom: str(sp, "dateFrom"),
    dateTo: str(sp, "dateTo"),
    categoryId: str(sp, "categoryId"),
    cashAccountId: str(sp, "cashAccountId"),
    search: str(sp, "q"),
    page,
  };

  const [result, categories, accounts] = await Promise.all([
    listExpenses(active.id, filters),
    listCategories(active.id),
    listCashAccounts(active.id),
  ]);

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }));
  const accountOptions = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
  }));

  const canWrite = WRITE_ROLES.includes(active.role);
  const canDelete = active.role === "owner" || active.role === "admin";
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v) next.set(k, v);
    }
    next.set("page", String(p));
    return `/expenses?${next}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">
          {active.name} · {result.total} expense
          {result.total === 1 ? "" : "s"}
        </p>
      </div>

      <ExpensesFilters categories={categoryOptions} accounts={accountOptions} />

      <ExpensesClient
        rows={result.rows}
        categories={categoryOptions}
        accounts={accountOptions}
        canWrite={canWrite}
        canDelete={canDelete}
        aiEnabled={isAiEnabled()}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {result.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink
              href={pageHref(result.page - 1)}
              disabled={result.page <= 1}
              label="Previous"
            />
            <PageLink
              href={pageHref(result.page + 1)}
              disabled={result.page >= totalPages}
              label="Next"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** Pagination control: a styled Link when navigable, a disabled span otherwise. */
function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  const cls = buttonVariants({ variant: "outline", size: "sm" });
  if (disabled) {
    return (
      <span aria-disabled className={cn(cls, "pointer-events-none opacity-50")}>
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}
