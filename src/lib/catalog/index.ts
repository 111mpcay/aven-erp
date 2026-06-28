import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { writeAudit } from "@/lib/audit";
import { getDb } from "@/lib/db/rls";
import { cashAccounts, categories } from "@/lib/db/schema";
import type { LedgerContext } from "@/lib/ledger";

/**
 * lib/catalog — the audited service for reference data (categories + cash
 * accounts) the expense form selects from. Same discipline as lib/ledger:
 * every mutation runs in one rls() transaction and writes an audit row in it.
 */

/* ----------------------------- categories ----------------------------- */

export type CategoryWrite = {
  name: string;
  kind: "income" | "cogs" | "expense";
  code?: string | null;
  parentId?: string | null;
};

export async function listCategories(companyId: string) {
  const db = await getDb();
  return db.rls((tx) =>
    tx
      .select()
      .from(categories)
      .where(eq(categories.companyId, companyId))
      .orderBy(asc(categories.kind), asc(categories.name)),
  );
}

export async function createCategory(ctx: LedgerContext, input: CategoryWrite) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [row] = await tx
      .insert(categories)
      .values({
        companyId: ctx.companyId,
        name: input.name,
        kind: input.kind,
        code: input.code ?? null,
        parentId: input.parentId ?? null,
      })
      .returning();
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "create",
      entityType: "category",
      entityId: row.id,
      after: row,
      ip: ctx.ip,
    });
    return row;
  });
}

export async function updateCategory(
  ctx: LedgerContext,
  id: string,
  input: CategoryWrite,
) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.companyId, ctx.companyId)));
    if (!before) throw new Error("Category not found.");
    const [row] = await tx
      .update(categories)
      .set({
        name: input.name,
        kind: input.kind,
        code: input.code ?? null,
        parentId: input.parentId ?? null,
      })
      .where(and(eq(categories.id, id), eq(categories.companyId, ctx.companyId)))
      .returning();
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "update",
      entityType: "category",
      entityId: id,
      before,
      after: row,
      ip: ctx.ip,
    });
    return row;
  });
}

export async function deleteCategory(ctx: LedgerContext, id: string) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.companyId, ctx.companyId)));
    if (!before) throw new Error("Category not found.");
    // expenses.category_id is ON DELETE RESTRICT — surface a clean message
    // instead of a raw FK error if the category is still in use.
    await tx
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.companyId, ctx.companyId)));
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "delete",
      entityType: "category",
      entityId: id,
      before,
      ip: ctx.ip,
    });
    return before;
  });
}

/* ---------------------------- cash accounts --------------------------- */

export type CashAccountWrite = {
  name: string;
  type: "bank" | "ewallet" | "cash";
  openingBalance: string;
  currency: string;
};

export async function listCashAccounts(companyId: string) {
  const db = await getDb();
  return db.rls((tx) =>
    tx
      .select()
      .from(cashAccounts)
      .where(eq(cashAccounts.companyId, companyId))
      .orderBy(asc(cashAccounts.name)),
  );
}

export async function createCashAccount(
  ctx: LedgerContext,
  input: CashAccountWrite,
) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [row] = await tx
      .insert(cashAccounts)
      .values({
        companyId: ctx.companyId,
        name: input.name,
        type: input.type,
        openingBalance: input.openingBalance,
        currency: input.currency,
      })
      .returning();
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "create",
      entityType: "cash_account",
      entityId: row.id,
      after: row,
      ip: ctx.ip,
    });
    return row;
  });
}

export async function updateCashAccount(
  ctx: LedgerContext,
  id: string,
  input: CashAccountWrite,
) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(cashAccounts)
      .where(
        and(eq(cashAccounts.id, id), eq(cashAccounts.companyId, ctx.companyId)),
      );
    if (!before) throw new Error("Cash account not found.");
    const [row] = await tx
      .update(cashAccounts)
      .set({
        name: input.name,
        type: input.type,
        openingBalance: input.openingBalance,
        currency: input.currency,
      })
      .where(
        and(eq(cashAccounts.id, id), eq(cashAccounts.companyId, ctx.companyId)),
      )
      .returning();
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "update",
      entityType: "cash_account",
      entityId: id,
      before,
      after: row,
      ip: ctx.ip,
    });
    return row;
  });
}

export async function deleteCashAccount(ctx: LedgerContext, id: string) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(cashAccounts)
      .where(
        and(eq(cashAccounts.id, id), eq(cashAccounts.companyId, ctx.companyId)),
      );
    if (!before) throw new Error("Cash account not found.");
    await tx
      .delete(cashAccounts)
      .where(
        and(eq(cashAccounts.id, id), eq(cashAccounts.companyId, ctx.companyId)),
      );
    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "delete",
      entityType: "cash_account",
      entityId: id,
      before,
      ip: ctx.ip,
    });
    return before;
  });
}
