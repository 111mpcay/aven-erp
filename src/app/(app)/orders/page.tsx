import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getActiveCompany, requireAuth, WRITE_ROLES } from "@/lib/auth/rbac";
import { listCashAccounts } from "@/lib/catalog";
import { listOrders } from "@/lib/orders";
import { OrdersClient } from "./orders-client";
import { OrdersFilters } from "./orders-filters";

type SearchParams = Record<string, string | string[] | undefined>;

function str(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const { active } = await getActiveCompany();

  if (!active) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any company yet. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const page = Math.max(1, Number(str(sp, "page") ?? "1") || 1);
  const ps = str(sp, "paymentStatus");
  const paymentStatus: "unpaid" | "partial" | "paid" | undefined =
    ps === "unpaid" || ps === "partial" || ps === "paid" ? ps : undefined;
  const filters = {
    dateFrom: str(sp, "dateFrom"),
    dateTo: str(sp, "dateTo"),
    paymentStatus,
    channel: str(sp, "channel"),
    search: str(sp, "q"),
    page,
  };

  const [result, accounts] = await Promise.all([
    listOrders(active.id, filters),
    listCashAccounts(active.id),
  ]);

  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const canWrite = WRITE_ROLES.includes(active.role);
  const canDelete = active.role === "owner" || active.role === "admin";
  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string" && v) next.set(k, v);
    }
    next.set("page", String(p));
    return `/orders?${next}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {active.name} · {result.total} order{result.total === 1 ? "" : "s"}
        </p>
      </div>

      <OrdersFilters />

      <OrdersClient
        rows={result.rows}
        accounts={accountOptions}
        canWrite={canWrite}
        canDelete={canDelete}
      />

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {result.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <PageLink href={pageHref(result.page - 1)} disabled={result.page <= 1} label="Previous" />
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

function PageLink({ href, disabled, label }: { href: string; disabled: boolean; label: string }) {
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
