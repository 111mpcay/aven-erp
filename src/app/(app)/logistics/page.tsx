import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getActiveCompany, requireAuth, WRITE_ROLES } from "@/lib/auth/rbac";
import {
  FULFILLMENT_STATUSES,
  getLogisticsBoard,
  type FulfillmentStatus,
} from "@/lib/logistics";
import { LogisticsClient } from "./logistics-client";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  packed: "Packed",
  shipped: "Shipped",
  in_transit: "In transit",
  delivered: "Delivered",
};

export default async function LogisticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const { active } = await getActiveCompany();

  if (!active) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Logistics</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any company yet. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "";
  const status = (FULFILLMENT_STATUSES as readonly string[]).includes(raw)
    ? (raw as FulfillmentStatus)
    : undefined;

  const board = await getLogisticsBoard(active.id, status);
  const canWrite = WRITE_ROLES.includes(active.role);
  const totalActive = FULFILLMENT_STATUSES.reduce((s, k) => s + (board.counts[k] ?? 0), 0);

  const chip = (href: string, label: string, count: number, activeChip: boolean) => (
    <Link
      key={label}
      href={href}
      className={cn(
        buttonVariants({ variant: activeChip ? "default" : "outline", size: "sm" }),
        "gap-1.5",
      )}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logistics</h1>
        <p className="text-sm text-muted-foreground">
          {active.name} · order fulfillment tracking
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>In transit</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {(board.counts.shipped ?? 0) + (board.counts.in_transit ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Awaiting dispatch</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {(board.counts.pending ?? 0) + (board.counts.packed ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Delivered</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{board.counts.delivered ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Delayed</CardDescription>
            <CardTitle
              className={cn(
                "text-2xl tabular-nums",
                board.delayedCount > 0 && "text-destructive",
              )}
            >
              {board.delayedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {chip("/logistics", `All`, totalActive, !status)}
        {FULFILLMENT_STATUSES.map((s) =>
          chip(`/logistics?status=${s}`, STATUS_LABELS[s], board.counts[s] ?? 0, status === s),
        )}
      </div>

      <LogisticsClient rows={board.rows} canWrite={canWrite} />
    </div>
  );
}
