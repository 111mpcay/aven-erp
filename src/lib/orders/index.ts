import "server-only";

import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

import { writeAudit } from "@/lib/audit";
import { getDb, type RlsTx } from "@/lib/db/rls";
import { cashAccounts, orderItems, orders } from "@/lib/db/schema";
import type { LedgerContext } from "@/lib/ledger";

/**
 * lib/orders — the single, audited path for the revenue / inflow stream.
 *
 * Totals and payment_status are computed HERE (never trusted from the client):
 * line_total = qty × unit_price, subtotal = Σ line_total, total = subtotal +
 * shipping − discount, COGS = Σ qty × unit_cost. A paid order's amount_paid
 * (×fx_to_php) attributed to cash_account_id is the cash inflow; the dashboard
 * (Phase 3) and posted ledger_entries (Phase 4) read it later.
 *
 * Money is computed in integer centavos to avoid float drift, then stored as
 * Drizzle `numeric` strings.
 */

const toCents = (s: string | number): number =>
  Math.round(Number(s) * 100) || 0;
const fromCents = (c: number): string => (c / 100).toFixed(2);
const mulCents = (a: string, b: string): number =>
  Math.round(Number(a) * Number(b) * 100) || 0;

export type OrderItemWrite = {
  productName: string;
  sku?: string | null;
  qty: string;
  unitPrice: string;
  unitCost?: string | null;
};

export type OrderWrite = {
  orderNo?: string | null;
  customerName?: string | null;
  channel: "shopee" | "lazada" | "tiktok" | "facebook" | "website" | "walk_in" | "other";
  orderDate: string;
  status?: "draft" | "confirmed" | "cancelled";
  cashAccountId?: string | null;
  shippingFee: string;
  discount: string;
  amountPaid: string;
  currency: string;
  fxToPhp: string;
  notes?: string | null;
  items: OrderItemWrite[];
};

type Computed = {
  subtotal: string;
  total: string;
  amountPaid: string;
  shippingFee: string;
  discount: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  itemRows: {
    productName: string;
    sku: string | null;
    qty: string;
    unitPrice: string;
    unitCost: string;
    lineTotal: string;
  }[];
};

function compute(input: OrderWrite): Computed {
  let subtotalCents = 0;
  const itemRows = input.items.map((it) => {
    const unitCost = it.unitCost ?? "0";
    const lineCents = mulCents(it.qty, it.unitPrice);
    subtotalCents += lineCents;
    return {
      productName: it.productName,
      sku: it.sku ?? null,
      qty: it.qty,
      unitPrice: it.unitPrice,
      unitCost,
      lineTotal: fromCents(lineCents),
    };
  });
  const shippingCents = toCents(input.shippingFee);
  const discountCents = toCents(input.discount);
  // Guard: discount can't exceed subtotal + shipping, else total goes negative
  // and corrupts revenue/cashflow math. (Money correctness is priority #1.)
  if (discountCents > subtotalCents + shippingCents) {
    throw new Error("Discount can't exceed the subtotal plus shipping.");
  }
  const totalCents = subtotalCents + shippingCents - discountCents;
  const paidCents = toCents(input.amountPaid);

  // total is now guaranteed >= 0. A zero-total order owes nothing → paid.
  const paymentStatus =
    totalCents <= 0
      ? "paid"
      : paidCents <= 0
        ? "unpaid"
        : paidCents >= totalCents
          ? "paid"
          : "partial";

  return {
    subtotal: fromCents(subtotalCents),
    total: fromCents(totalCents),
    amountPaid: fromCents(paidCents),
    shippingFee: fromCents(shippingCents),
    discount: fromCents(discountCents),
    paymentStatus,
    itemRows,
  };
}

/** Defense in depth: confirm the payment account belongs to the active company. */
async function assertAccountInCompany(
  tx: RlsTx,
  companyId: string,
  cashAccountId: string | null | undefined,
) {
  if (!cashAccountId) return;
  const [a] = await tx
    .select({ id: cashAccounts.id })
    .from(cashAccounts)
    .where(and(eq(cashAccounts.id, cashAccountId), eq(cashAccounts.companyId, companyId)));
  if (!a) throw new Error("Selected cash account does not belong to this company.");
}

/** Next per-company order number, e.g. ORD-000123. Unique constraint backstops races. */
async function nextOrderNo(tx: RlsTx, companyId: string): Promise<string> {
  const rows = await tx
    .select({ orderNo: orders.orderNo })
    .from(orders)
    .where(eq(orders.companyId, companyId));
  let max = 0;
  for (const r of rows) {
    const m = /(\d+)\s*$/.exec(r.orderNo);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `ORD-${String(max + 1).padStart(6, "0")}`;
}

export async function createOrder(ctx: LedgerContext, input: OrderWrite) {
  const db = await getDb();
  return db.rls(async (tx) => {
    await assertAccountInCompany(tx, ctx.companyId, input.cashAccountId);
    const c = compute(input);
    const orderNo = input.orderNo?.trim() || (await nextOrderNo(tx, ctx.companyId));

    const [order] = await tx
      .insert(orders)
      .values({
        companyId: ctx.companyId,
        orderNo,
        customerName: input.customerName ?? null,
        channel: input.channel,
        orderDate: input.orderDate,
        status: input.status ?? "confirmed",
        paymentStatus: c.paymentStatus,
        cashAccountId: input.cashAccountId ?? null,
        subtotal: c.subtotal,
        shippingFee: c.shippingFee,
        discount: c.discount,
        total: c.total,
        amountPaid: c.amountPaid,
        currency: input.currency,
        fxToPhp: input.fxToPhp,
        notes: input.notes ?? null,
        createdBy: ctx.userId,
      })
      .returning();

    const items = await tx
      .insert(orderItems)
      .values(c.itemRows.map((r) => ({ ...r, orderId: order.id })))
      .returning();

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "create",
      entityType: "order",
      entityId: order.id,
      after: { ...order, items },
      ip: ctx.ip,
    });
    return order;
  });
}

export async function updateOrder(ctx: LedgerContext, id: string, input: OrderWrite) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.companyId, ctx.companyId)));
    if (!before) throw new Error("Order not found.");
    const beforeItems = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    await assertAccountInCompany(tx, ctx.companyId, input.cashAccountId);
    const c = compute(input);

    const [order] = await tx
      .update(orders)
      .set({
        orderNo: input.orderNo?.trim() || before.orderNo,
        customerName: input.customerName ?? null,
        channel: input.channel,
        orderDate: input.orderDate,
        status: input.status ?? before.status,
        paymentStatus: c.paymentStatus,
        cashAccountId: input.cashAccountId ?? null,
        subtotal: c.subtotal,
        shippingFee: c.shippingFee,
        discount: c.discount,
        total: c.total,
        amountPaid: c.amountPaid,
        currency: input.currency,
        fxToPhp: input.fxToPhp,
        notes: input.notes ?? null,
      })
      .where(and(eq(orders.id, id), eq(orders.companyId, ctx.companyId)))
      .returning();

    // Replace line items wholesale (simplest correct strategy for an edit).
    await tx.delete(orderItems).where(eq(orderItems.orderId, id));
    const items = await tx
      .insert(orderItems)
      .values(c.itemRows.map((r) => ({ ...r, orderId: id })))
      .returning();

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "update",
      entityType: "order",
      entityId: id,
      before: { ...before, items: beforeItems },
      after: { ...order, items },
      ip: ctx.ip,
    });
    return order;
  });
}

export async function deleteOrder(ctx: LedgerContext, id: string) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.companyId, ctx.companyId)));
    if (!before) throw new Error("Order not found.");
    const beforeItems = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));

    // order_items cascade-delete with the order.
    await tx.delete(orders).where(and(eq(orders.id, id), eq(orders.companyId, ctx.companyId)));

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "delete",
      entityType: "order",
      entityId: id,
      before: { ...before, items: beforeItems },
      ip: ctx.ip,
    });
    return before;
  });
}

export type OrderFilters = {
  dateFrom?: string;
  dateTo?: string;
  paymentStatus?: "unpaid" | "partial" | "paid";
  channel?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type OrderRow = {
  id: string;
  orderNo: string;
  customerName: string | null;
  channel: string;
  orderDate: string;
  status: string;
  paymentStatus: "unpaid" | "partial" | "paid";
  total: string;
  amountPaid: string;
  cogs: string;
  currency: string;
  cashAccountId: string | null;
  cashAccountName: string | null;
};

const DEFAULT_PAGE_SIZE = 25;

export async function listOrders(companyId: string, filters: OrderFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const conditions = [eq(orders.companyId, companyId)];
  if (filters.dateFrom) conditions.push(gte(orders.orderDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(orders.orderDate, filters.dateTo));
  if (filters.paymentStatus)
    conditions.push(eq(orders.paymentStatus, filters.paymentStatus));
  const CHANNELS = ["shopee", "lazada", "tiktok", "facebook", "website", "walk_in", "other"];
  if (filters.channel && CHANNELS.includes(filters.channel)) {
    conditions.push(eq(orders.channel, filters.channel as never));
  }
  if (filters.search) {
    const needle = `%${filters.search}%`;
    const match = or(ilike(orders.orderNo, needle), ilike(orders.customerName, needle));
    if (match) conditions.push(match);
  }
  const where = and(...conditions);
  // Round per line to centavos so COGS matches the 2-dp money convention used
  // for line_total (qty*unit_cost is numeric scale 4 in Postgres).
  const cogsExpr = sql<string>`(select coalesce(sum(round(qty * unit_cost, 2)), 0) from order_items where order_id = ${orders.id})`;

  const db = await getDb();
  return db.rls(async (tx) => {
    const rows = await tx
      .select({
        id: orders.id,
        orderNo: orders.orderNo,
        customerName: orders.customerName,
        channel: orders.channel,
        orderDate: orders.orderDate,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        total: orders.total,
        amountPaid: orders.amountPaid,
        cogs: cogsExpr,
        currency: orders.currency,
        cashAccountId: orders.cashAccountId,
        cashAccountName: cashAccounts.name,
      })
      .from(orders)
      .leftJoin(cashAccounts, eq(cashAccounts.id, orders.cashAccountId))
      .where(where)
      .orderBy(desc(orders.orderDate), desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(orders)
      .where(where);

    return { rows: rows as OrderRow[], total, page, pageSize };
  });
}

export type OrderWithItems = Awaited<ReturnType<typeof getOrder>>;

export async function getOrder(companyId: string, id: string) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.companyId, companyId)));
    if (!order) return null;
    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, id));
    return { ...order, items };
  });
}
