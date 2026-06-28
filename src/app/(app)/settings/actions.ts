"use server";

import { revalidatePath } from "next/cache";

import { getClientIp, requireRole, WRITE_ROLES } from "@/lib/auth/rbac";
import {
  createCashAccount,
  createCategory,
  deleteCashAccount,
  deleteCategory,
  updateCashAccount,
  updateCategory,
} from "@/lib/catalog";
import {
  CashAccountCreateSchema,
  CashAccountUpdateSchema,
} from "@/lib/validation/cash-account";
import {
  CategoryCreateSchema,
  CategoryUpdateSchema,
} from "@/lib/validation/category";

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

function opt(formData: FormData, key: string): string | undefined {
  const v = String(formData.get(key) ?? "").trim();
  return v ? v : undefined;
}

/* ----------------------------- categories ----------------------------- */

function readCategory(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    kind: String(formData.get("kind") ?? ""),
    code: opt(formData, "code"),
    parentId: opt(formData, "parentId") ?? null,
  };
}

export async function createCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();
  const parsed = CategoryCreateSchema.safeParse(readCategory(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }
  try {
    await createCategory({ ...ctx, ip }, parsed.data);
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, "category") };
  }
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();
  const parsed = CategoryUpdateSchema.safeParse({
    ...readCategory(formData),
    id: String(formData.get("id") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }
  try {
    await updateCategory({ ...ctx, ip }, parsed.data.id, parsed.data);
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, "category") };
  }
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteCategoryAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing category id." };
  try {
    await deleteCategory({ ...ctx, ip }, id);
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, "category") };
  }
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return { ok: true };
}

/* ---------------------------- cash accounts --------------------------- */

function readCashAccount(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    type: String(formData.get("type") ?? ""),
    openingBalance: String(formData.get("openingBalance") ?? "0") || "0",
    currency: String(formData.get("currency") ?? "PHP"),
  };
}

export async function createCashAccountAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();
  const parsed = CashAccountCreateSchema.safeParse(readCashAccount(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }
  try {
    await createCashAccount({ ...ctx, ip }, parsed.data);
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, "account") };
  }
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return { ok: true };
}

export async function updateCashAccountAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(WRITE_ROLES);
  const ip = await getClientIp();
  const parsed = CashAccountUpdateSchema.safeParse({
    ...readCashAccount(formData),
    id: String(formData.get("id") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: firstFieldErrors(parsed.error.issues) };
  }
  try {
    await updateCashAccount({ ...ctx, ip }, parsed.data.id, parsed.data);
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, "account") };
  }
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return { ok: true };
}

export async function deleteCashAccountAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const ctx = await requireRole(["owner", "admin"]);
  const ip = await getClientIp();
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing account id." };
  try {
    await deleteCashAccount({ ...ctx, ip }, id);
  } catch (e) {
    return { ok: false, error: friendlyDbError(e, "account") };
  }
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return { ok: true };
}

/** Turn Postgres FK/unique violations into messages a non-technical user gets. */
function friendlyDbError(e: unknown, entity: "category" | "account"): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/foreign key|violates foreign key|still referenced/i.test(msg)) {
    return `This ${entity} is in use by existing expenses and can't be deleted.`;
  }
  if (/duplicate key|unique constraint/i.test(msg)) {
    return entity === "account"
      ? "An account with that name already exists."
      : "A category with that code already exists.";
  }
  return e instanceof Error ? e.message : `Failed to save ${entity}.`;
}
