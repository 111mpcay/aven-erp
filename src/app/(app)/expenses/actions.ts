"use server";

import { revalidatePath } from "next/cache";

import { getClientIp, requireRole, WRITE_ROLES } from "@/lib/auth/rbac";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  type ExpenseWrite,
} from "@/lib/ledger";
import { deleteReceipt, uploadReceipt } from "@/lib/storage/receipts";
import { ExpenseCreateSchema, ExpenseUpdateSchema } from "@/lib/validation/expense";

export type ActionResult = {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function firstFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "");
    if (key && !out[key]) out[key] = i.message;
  }
  return out;
}

function readExpenseForm(formData: FormData) {
  return {
    expenseDate: String(formData.get("expenseDate") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    cashAccountId: String(formData.get("cashAccountId") ?? ""),
    vendor: (formData.get("vendor") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    amount: String(formData.get("amount") ?? ""),
    currency: String(formData.get("currency") ?? "PHP"),
    fxToPhp: String(formData.get("fxToPhp") ?? "1"),
  };
}

function receiptFile(formData: FormData): File | null {
  const f = formData.get("receipt");
  return f instanceof File && f.size > 0 ? f : null;
}

function toWrite(
  parsed: {
    expenseDate: string;
    categoryId: string;
    cashAccountId: string;
    vendor?: string;
    description?: string;
    amount: string;
    currency: string;
    fxToPhp: string;
  },
  receiptPath: string | null,
): ExpenseWrite {
  return {
    expenseDate: parsed.expenseDate,
    categoryId: parsed.categoryId,
    cashAccountId: parsed.cashAccountId,
    vendor: parsed.vendor ?? null,
    description: parsed.description ?? null,
    amount: parsed.amount,
    currency: parsed.currency,
    fxToPhp: parsed.fxToPhp,
    receiptPath,
  };
}

export async function createExpenseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();

  const parsed = ExpenseCreateSchema.safeParse(readExpenseForm(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }

  try {
    const file = receiptFile(formData);
    const receiptPath = file ? await uploadReceipt(ctx.companyId, file) : null;
    await createExpense({ ...ctx, ip }, toWrite(parsed.data, receiptPath));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save expense." };
  }

  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateExpenseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();

  const parsed = ExpenseUpdateSchema.safeParse({
    ...readExpenseForm(formData),
    id: String(formData.get("id") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }

  try {
    const file = receiptFile(formData);
    // Keep the existing receipt unless a new file replaces it.
    const existingPath = (formData.get("existingReceiptPath") as string) || null;
    const receiptPath = file
      ? await uploadReceipt(ctx.companyId, file)
      : existingPath;
    await updateExpense({ ...ctx, ip }, parsed.data.id, toWrite(parsed.data, receiptPath));
    if (file && existingPath) await deleteReceipt(existingPath); // best-effort cleanup
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update expense." };
  }

  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteExpenseAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  // Delete is privileged (PIN-gating arrives in Phase 5; for now owner/admin only).
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing expense id." };

  try {
    const removed = await deleteExpense({ ...ctx, ip }, id);
    if (removed?.receiptPath) await deleteReceipt(removed.receiptPath);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete expense." };
  }

  revalidatePath("/expenses");
  return { ok: true };
}
