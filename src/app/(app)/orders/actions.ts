"use server";

import { revalidatePath } from "next/cache";

import { hasValidPinToken } from "@/lib/auth/pin";
import { getClientIp, requireRole, WRITE_ROLES } from "@/lib/auth/rbac";
import {
  createOrder,
  deleteOrder,
  getOrder,
  updateOrder,
  type OrderWrite,
} from "@/lib/orders";
import { OrderCreateSchema, OrderUpdateSchema } from "@/lib/validation/order";
import type { EditableOrder } from "./types";

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** The action is PIN-gated and no fresh PIN token exists — prompt and retry. */
  pinRequired?: boolean;
};

const PIN_GATE: ActionResult = {
  ok: false,
  pinRequired: true,
  error: "This action needs your PIN.",
};

function firstFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    // Collapse nested item paths (items.0.productName) to a single "items" key.
    const key = i.path[0] === "items" ? "items" : String(i.path[0] ?? "");
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}

function opt(formData: FormData, key: string): string | undefined {
  const v = String(formData.get(key) ?? "").trim();
  return v ? v : undefined;
}

function readOrderForm(formData: FormData) {
  let items: unknown = [];
  try {
    items = JSON.parse(String(formData.get("itemsJson") ?? "[]"));
  } catch {
    items = [];
  }
  return {
    orderNo: opt(formData, "orderNo"),
    customerName: opt(formData, "customerName"),
    channel: String(formData.get("channel") ?? ""),
    orderDate: String(formData.get("orderDate") ?? ""),
    status: String(formData.get("status") ?? "confirmed"),
    cashAccountId: opt(formData, "cashAccountId"),
    shippingFee: String(formData.get("shippingFee") ?? "0") || "0",
    discount: String(formData.get("discount") ?? "0") || "0",
    amountPaid: String(formData.get("amountPaid") ?? "0") || "0",
    currency: String(formData.get("currency") ?? "PHP"),
    fxToPhp: String(formData.get("fxToPhp") ?? "1") || "1",
    notes: opt(formData, "notes"),
    items,
  };
}

export async function createOrderAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();
  const parsed = OrderCreateSchema.safeParse(readOrderForm(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }
  try {
    await createOrder({ ...ctx, ip }, parsed.data as OrderWrite);
  } catch (e) {
    return { ok: false, error: friendlyError(e, "order") };
  }
  revalidatePath("/orders");
  return { ok: true };
}

export async function updateOrderAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();
  const parsed = OrderUpdateSchema.safeParse({
    ...readOrderForm(formData),
    id: String(formData.get("id") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }

  // PIN gate: editing an order is a posted-record edit (most are confirmed).
  if (!(await hasValidPinToken(ctx.userId))) return PIN_GATE;

  try {
    await updateOrder({ ...ctx, ip }, parsed.data.id, parsed.data as OrderWrite);
  } catch (e) {
    return { ok: false, error: friendlyError(e, "order") };
  }
  revalidatePath("/orders");
  return { ok: true };
}

export async function deleteOrderAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();

  // PIN gate: deletes are always sensitive.
  if (!(await hasValidPinToken(ctx.userId))) return PIN_GATE;

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing order id." };
  try {
    await deleteOrder({ ...ctx, ip }, id);
  } catch (e) {
    return { ok: false, error: friendlyError(e, "order") };
  }
  revalidatePath("/orders");
  return { ok: true };
}

/** Fetch an order + its items to prefill the edit form. */
export async function getOrderForEdit(id: string): Promise<EditableOrder | null> {
  const ctx = await requireRole(WRITE_ROLES);
  const order = await getOrder(ctx.companyId, id);
  if (!order) return null;
  return {
    id: order.id,
    orderNo: order.orderNo,
    customerName: order.customerName,
    channel: order.channel,
    orderDate: order.orderDate,
    status: order.status,
    cashAccountId: order.cashAccountId,
    shippingFee: order.shippingFee,
    discount: order.discount,
    amountPaid: order.amountPaid,
    currency: order.currency,
    fxToPhp: order.fxToPhp,
    notes: order.notes,
    items: order.items.map((it) => ({
      productName: it.productName,
      sku: it.sku ?? "",
      qty: it.qty,
      unitPrice: it.unitPrice,
      unitCost: it.unitCost,
    })),
  };
}

function friendlyError(e: unknown, entity: string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/duplicate key|unique constraint/i.test(msg)) {
    return "That order number is already used in this company.";
  }
  if (/foreign key/i.test(msg)) {
    return "A referenced record no longer exists.";
  }
  return e instanceof Error ? e.message : `Failed to save ${entity}.`;
}
