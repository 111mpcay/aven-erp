import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db/rls";
import { orders, shipments } from "@/lib/db/schema";
import type { LedgerContext } from "@/lib/ledger";

/**
 * lib/logistics — order fulfillment tracking (Phase 7), built on the order model.
 *
 * The order's fulfillment_status/courier/tracking_no/shipped_at/delivered_at are
 * the board-facing summary; the shipments row adds shipping cost + a detail
 * record. updateFulfillment writes BOTH in one rls() transaction (kept
 * consistent), stamps shipped_at/delivered_at on the matching transition, and
 * audits. Fulfillment is an operational update (not PIN-gated); role-gated to
 * write roles at the action layer + RLS at the DB.
 */

export const FULFILLMENT_STATUSES = [
  "pending",
  "packed",
  "shipped",
  "in_transit",
  "delivered",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/** Days a shipped-but-undelivered order can sit before it's flagged "delayed". */
const DELAYED_AFTER_DAYS = 7;

export type FulfillmentWrite = {
  status: FulfillmentStatus;
  courier?: string | null;
  trackingNo?: string | null;
  cost?: string | null;
};

export async function updateFulfillment(
  ctx: LedgerContext,
  orderId: string,
  input: FulfillmentWrite,
) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, orderId), eq(orders.companyId, ctx.companyId)));
    if (!order) throw new Error("Order not found.");

    // Derive lifecycle stamps FROM the target status so backward transitions
    // (e.g. delivered → packed) clear stale stamps instead of leaving the row
    // internally inconsistent. Keep an existing stamp when staying in-phase.
    const now = new Date();
    const inShippedPhase = ["shipped", "in_transit", "delivered"].includes(input.status);
    const shippedAt = inShippedPhase ? (order.shippedAt ?? now) : null;
    const deliveredAt = input.status === "delivered" ? (order.deliveredAt ?? now) : null;

    const [updatedOrder] = await tx
      .update(orders)
      .set({
        fulfillmentStatus: input.status,
        courier: input.courier ?? null,
        trackingNo: input.trackingNo ?? null,
        shippedAt,
        deliveredAt,
      })
      .where(and(eq(orders.id, orderId), eq(orders.companyId, ctx.companyId)))
      .returning();

    // Upsert the detail shipment (one per order).
    await tx
      .insert(shipments)
      .values({
        companyId: ctx.companyId,
        orderId,
        status: input.status,
        courier: input.courier ?? null,
        trackingNo: input.trackingNo ?? null,
        cost: input.cost ?? "0",
        currency: order.currency,
        shippedAt,
        deliveredAt,
      })
      .onConflictDoUpdate({
        target: shipments.orderId,
        set: {
          status: input.status,
          courier: input.courier ?? null,
          trackingNo: input.trackingNo ?? null,
          cost: input.cost ?? "0",
          shippedAt,
          deliveredAt,
        },
      });

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "update",
      entityType: "fulfillment",
      entityId: orderId,
      before: {
        status: order.fulfillmentStatus,
        courier: order.courier,
        trackingNo: order.trackingNo,
      },
      after: { status: input.status, courier: input.courier, trackingNo: input.trackingNo },
      ip: ctx.ip,
    });
    return updatedOrder;
  });
}

export type LogisticsRow = {
  id: string;
  orderNo: string;
  customerName: string | null;
  orderDate: string;
  fulfillmentStatus: FulfillmentStatus | null;
  courier: string | null;
  trackingNo: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  shippingCost: string | null;
  delayed: boolean;
};

export type LogisticsBoard = {
  rows: LogisticsRow[];
  counts: Record<string, number>;
  delayedCount: number;
};

/**
 * Fulfillment board for the active company. Only non-cancelled orders. "delayed"
 * = shipped/in_transit and not delivered after DELAYED_AFTER_DAYS.
 */
export async function getLogisticsBoard(
  companyId: string,
  statusFilter?: FulfillmentStatus,
): Promise<LogisticsBoard> {
  const conditions = [
    eq(orders.companyId, companyId),
    sql`${orders.status} <> 'cancelled'`,
  ];
  if (statusFilter) {
    conditions.push(eq(orders.fulfillmentStatus, statusFilter));
  }

  const db = await getDb();
  return db.rls(async (tx) => {
    const rows = await tx
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        customerName: orders.customerName,
        orderDate: orders.orderDate,
        fulfillmentStatus: orders.fulfillmentStatus,
        courier: orders.courier,
        trackingNo: orders.trackingNo,
        shippedAt: orders.shippedAt,
        deliveredAt: orders.deliveredAt,
        shippingCost: shipments.cost,
        delayed: sql<boolean>`(
          ${orders.fulfillmentStatus} in ('shipped','in_transit')
          and ${orders.shippedAt} is not null
          and ${orders.deliveredAt} is null
          and ${orders.shippedAt} < now() - interval '${sql.raw(String(DELAYED_AFTER_DAYS))} days'
        )`,
      })
      .from(orders)
      .leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(and(...conditions))
      .orderBy(desc(orders.orderDate));

    // Status counts across all non-cancelled orders (ignores the status filter).
    const countRows = (await tx.execute(sql`
      select coalesce(fulfillment_status::text, 'pending') as status, count(*)::int as n
      from orders
      where company_id = ${companyId} and status <> 'cancelled'
      group by coalesce(fulfillment_status::text, 'pending')
    `)) as unknown as { status: string; n: number }[];

    const counts: Record<string, number> = {};
    for (const s of FULFILLMENT_STATUSES) counts[s] = 0;
    for (const r of countRows) counts[r.status] = r.n;

    // Company-wide delayed count (independent of the status filter, so the KPI
    // card stays consistent with the other global cards).
    const [delayed] = (await tx.execute(sql`
      select count(*)::int as n from orders
      where company_id = ${companyId} and status <> 'cancelled'
        and fulfillment_status in ('shipped','in_transit')
        and shipped_at is not null and delivered_at is null
        and shipped_at < now() - interval '${sql.raw(String(DELAYED_AFTER_DAYS))} days'
    `)) as unknown as { n: number }[];

    return {
      rows: rows as LogisticsRow[],
      counts,
      delayedCount: delayed?.n ?? 0,
    };
  });
}
