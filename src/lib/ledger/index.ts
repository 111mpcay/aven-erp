import "server-only";

import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";

import { writeAudit } from "@/lib/audit";
import { getDb, type RlsTx } from "@/lib/db/rls";
import { cashAccounts, categories, expenses } from "@/lib/db/schema";

/**
 * lib/ledger — the single, audited path for the expense outflow stream.
 *
 * CLAUDE.md: ALL expenses are created via createExpense(); never insert into
 * `expenses` directly. Manual entry, CSV import, recurring jobs, and the Phase 6
 * Meta Ads sync all funnel through here, so reports/cashflow never care where an
 * expense came from. Each write opens one rls() transaction and records an
 * audit row in the same transaction (atomic).
 *
 * Phase 1 only persists the expense row. Posting to `ledger_entries` and
 * derived cashflow views arrive in Phase 3/4 — they slot in here without
 * touching callers.
 */

export type LedgerContext = {
  userId: string;
  companyId: string;
  ip?: string | null;
};

/**
 * Defense in depth: the form supplies category/account ids, and the active
 * company is a switchable cookie — RLS only checks expenses.company_id, so
 * confirm the referenced rows actually belong to the active company before
 * writing. Prevents an expense referencing another company's reference data.
 */
async function assertRefsInCompany(
  tx: RlsTx,
  companyId: string,
  categoryId: string | null,
  cashAccountId: string | null,
) {
  if (categoryId) {
    const [c] = await tx
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.companyId, companyId)));
    if (!c) throw new Error("Selected category does not belong to this company.");
  }
  if (cashAccountId) {
    const [a] = await tx
      .select({ id: cashAccounts.id })
      .from(cashAccounts)
      .where(
        and(eq(cashAccounts.id, cashAccountId), eq(cashAccounts.companyId, companyId)),
      );
    if (!a) throw new Error("Selected cash account does not belong to this company.");
  }
}

export type ExpenseWrite = {
  expenseDate: string;
  categoryId: string | null;
  cashAccountId: string | null;
  vendor?: string | null;
  description?: string | null;
  amount: string; // decimal string — never a float (see lib/validation/money)
  currency: string;
  fxToPhp: string;
  source?: "manual" | "meta_ads" | "import" | "recurring";
  sourceRef?: string | null;
  receiptPath?: string | null;
  status?: "draft" | "approved";
};

export async function createExpense(ctx: LedgerContext, input: ExpenseWrite) {
  const db = await getDb();
  return db.rls(async (tx) => {
    await assertRefsInCompany(tx, ctx.companyId, input.categoryId, input.cashAccountId);
    const [row] = await tx
      .insert(expenses)
      .values({
        companyId: ctx.companyId,
        expenseDate: input.expenseDate,
        categoryId: input.categoryId,
        cashAccountId: input.cashAccountId,
        vendor: input.vendor ?? null,
        description: input.description ?? null,
        amount: input.amount,
        currency: input.currency,
        fxToPhp: input.fxToPhp,
        source: input.source ?? "manual",
        sourceRef: input.sourceRef ?? null,
        receiptPath: input.receiptPath ?? null,
        status: input.status ?? "approved",
        createdBy: ctx.userId,
      })
      .returning();

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "create",
      entityType: "expense",
      entityId: row.id,
      after: row,
      ip: ctx.ip,
    });
    return row;
  });
}

export async function updateExpense(
  ctx: LedgerContext,
  id: string,
  input: ExpenseWrite,
) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.companyId, ctx.companyId)));
    if (!before) throw new Error("Expense not found.");
    await assertRefsInCompany(tx, ctx.companyId, input.categoryId, input.cashAccountId);

    const [row] = await tx
      .update(expenses)
      .set({
        expenseDate: input.expenseDate,
        categoryId: input.categoryId,
        cashAccountId: input.cashAccountId,
        vendor: input.vendor ?? null,
        description: input.description ?? null,
        amount: input.amount,
        currency: input.currency,
        fxToPhp: input.fxToPhp,
        receiptPath: input.receiptPath ?? null,
        status: input.status ?? before.status,
      })
      .where(and(eq(expenses.id, id), eq(expenses.companyId, ctx.companyId)))
      .returning();

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "update",
      entityType: "expense",
      entityId: id,
      before,
      after: row,
      ip: ctx.ip,
    });
    return row;
  });
}

export async function deleteExpense(ctx: LedgerContext, id: string) {
  const db = await getDb();
  return db.rls(async (tx) => {
    const [before] = await tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.companyId, ctx.companyId)));
    if (!before) throw new Error("Expense not found.");

    await tx
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.companyId, ctx.companyId)));

    await writeAudit(tx, {
      actorId: ctx.userId,
      companyId: ctx.companyId,
      action: "delete",
      entityType: "expense",
      entityId: id,
      before,
      ip: ctx.ip,
    });
    return before;
  });
}

export type ExpenseFilters = {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  cashAccountId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type ExpenseRow = {
  id: string;
  expenseDate: string;
  vendor: string | null;
  description: string | null;
  amount: string;
  currency: string;
  fxToPhp: string;
  status: "draft" | "approved";
  source: "manual" | "meta_ads" | "import" | "recurring";
  receiptPath: string | null;
  categoryId: string | null;
  categoryName: string | null;
  cashAccountId: string | null;
  cashAccountName: string | null;
};

const DEFAULT_PAGE_SIZE = 25;

/**
 * Filtered, paginated expense list for the active company. RLS already blocks
 * cross-company rows; we still filter by companyId so the (company_id, date)
 * index is used and only the active entity shows.
 */
export async function listExpenses(companyId: string, filters: ExpenseFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));

  const conditions = [eq(expenses.companyId, companyId)];
  if (filters.dateFrom) conditions.push(gte(expenses.expenseDate, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(expenses.expenseDate, filters.dateTo));
  if (filters.categoryId) conditions.push(eq(expenses.categoryId, filters.categoryId));
  if (filters.cashAccountId)
    conditions.push(eq(expenses.cashAccountId, filters.cashAccountId));
  if (filters.search) {
    const needle = `%${filters.search}%`;
    const match = or(
      ilike(expenses.vendor, needle),
      ilike(expenses.description, needle),
    );
    if (match) conditions.push(match);
  }
  const where = and(...conditions);

  const db = await getDb();
  return db.rls(async (tx) => {
    const rows = await tx
      .select({
        id: expenses.id,
        expenseDate: expenses.expenseDate,
        vendor: expenses.vendor,
        description: expenses.description,
        amount: expenses.amount,
        currency: expenses.currency,
        fxToPhp: expenses.fxToPhp,
        status: expenses.status,
        source: expenses.source,
        receiptPath: expenses.receiptPath,
        categoryId: expenses.categoryId,
        categoryName: categories.name,
        cashAccountId: expenses.cashAccountId,
        cashAccountName: cashAccounts.name,
      })
      .from(expenses)
      .leftJoin(categories, eq(categories.id, expenses.categoryId))
      .leftJoin(cashAccounts, eq(cashAccounts.id, expenses.cashAccountId))
      .where(where)
      .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ total }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(expenses)
      .where(where);

    return { rows: rows as ExpenseRow[], total, page, pageSize };
  });
}
