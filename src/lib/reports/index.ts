import "server-only";

import { sql } from "drizzle-orm";

import { normalizeRange } from "@/lib/cashflow";
import { getDb, type RlsTx } from "@/lib/db/rls";

/**
 * lib/reports — management-grade accounting reports, DERIVED from orders +
 * expenses (PROJECT_PLAN §8E safe path; the posted ledger takes over when
 * volume demands). Money convention: round per TRANSACTION to centavos, then
 * sum — every report ties exactly with the dashboard and each other.
 *
 * Recognition rules (management-grade, accrual on business dates):
 *  - Revenue  = confirmed orders' total (order_date) — drafts aren't sales,
 *    cancelled orders never count.
 *  - COGS     = Σ round(qty × unit_cost) of those orders' items.
 *  - Expenses = approved expenses by category (expense_date).
 *  - Cashflow statement is CASH basis: amount_paid on non-cancelled orders in
 *    the period vs approved expenses in the period (same as the dashboard).
 */

export type MoneyRow = {
  /** category id, or null for the uncategorized bucket — use as the row key */
  id: string | null;
  label: string;
  amount: string;
  share?: string;
};

export type ProfitAndLoss = {
  revenue: string;
  cogs: string;
  grossProfit: string;
  expensesByCategory: MoneyRow[];
  totalExpenses: string;
  netProfit: string;
};

export type PnlComparison = {
  current: ProfitAndLoss;
  previous: ProfitAndLoss;
  previousRange: { from: string; to: string };
};

export type CashflowStatement = {
  beginningCash: string;
  cashIn: string;
  cashOut: string;
  netChange: string;
  endingCash: string;
};

const DAY_MS = 86_400_000;
const fmt = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

async function pnlForRange(
  tx: RlsTx,
  companyId: string,
  range: { from: string; to: string },
): Promise<ProfitAndLoss> {
  const revRes = await tx.execute(sql`
    select
      coalesce(sum(round(o.total * o.fx_to_php, 2)), 0)::text as revenue,
      coalesce((
        select sum(round(oi.qty * oi.unit_cost * o2.fx_to_php, 2))
        from order_items oi
        join orders o2 on o2.id = oi.order_id
        where o2.company_id = ${companyId} and o2.status = 'confirmed'
          and o2.order_date between ${range.from}::date and ${range.to}::date
      ), 0)::text as cogs
    from orders o
    where o.company_id = ${companyId} and o.status = 'confirmed'
      and o.order_date between ${range.from}::date and ${range.to}::date
  `);
  const rev = (revRes as unknown as { revenue: string; cogs: string }[])[0];

  // Group by category_id (not name) so same-named categories stay distinct and
  // the null bucket can't collide with a category literally named Uncategorized.
  const expRes = await tx.execute(sql`
    select e.category_id as id,
           coalesce(c.name, 'Uncategorized') as label,
           coalesce(c.code, '') as code,
           sum(round(e.amount * e.fx_to_php, 2))::text as amount
    from expenses e
    left join categories c on c.id = e.category_id
    where e.company_id = ${companyId} and e.status = 'approved'
      and e.expense_date between ${range.from}::date and ${range.to}::date
    group by e.category_id, c.name, c.code
    order by sum(round(e.amount * e.fx_to_php, 2)) desc
  `);
  const expRows = expRes as unknown as {
    id: string | null;
    label: string;
    code: string;
    amount: string;
  }[];

  const revenue = Number(rev.revenue);
  const cogs = Number(rev.cogs);
  const totalExpenses = expRows.reduce((s, r) => s + Number(r.amount), 0);
  const gross = revenue - cogs;

  return {
    revenue: fmt(revenue),
    cogs: fmt(cogs),
    grossProfit: fmt(gross),
    expensesByCategory: expRows.map((r) => ({
      id: r.id,
      label: r.code ? `${r.code} · ${r.label}` : r.label,
      amount: r.amount,
      share: totalExpenses > 0 ? ((Number(r.amount) / totalExpenses) * 100).toFixed(1) : "0.0",
    })),
    totalExpenses: fmt(totalExpenses),
    netProfit: fmt(gross - totalExpenses),
  };
}

/** P&L for the range plus the equal-length period immediately before it. */
export async function getPnlComparison(
  companyId: string,
  rawRange: { from: string; to: string },
): Promise<PnlComparison> {
  const range = normalizeRange(rawRange);
  const fromMs = Date.parse(`${range.from}T00:00:00Z`);
  const toMs = Date.parse(`${range.to}T00:00:00Z`);
  const spanDays = (toMs - fromMs) / DAY_MS + 1; // inclusive length
  const prevTo = new Date(fromMs - DAY_MS).toISOString().slice(0, 10);
  const prevFrom = new Date(fromMs - spanDays * DAY_MS).toISOString().slice(0, 10);

  const db = await getDb();
  return db.rls(async (tx) => {
    const current = await pnlForRange(tx, companyId, range);
    const previous = await pnlForRange(tx, companyId, { from: prevFrom, to: prevTo });
    return { current, previous, previousRange: { from: prevFrom, to: prevTo } };
  });
}

/** Cash-basis statement: beginning cash → in/out during the period → ending. */
export async function getCashflowStatement(
  companyId: string,
  rawRange: { from: string; to: string },
): Promise<CashflowStatement> {
  const range = normalizeRange(rawRange);
  const db = await getDb();
  return db.rls(async (tx) => {
    const res = await tx.execute(sql`
      select
        coalesce((select sum(opening_balance) from cash_accounts
          where company_id = ${companyId}), 0)::text as opening,
        coalesce((select sum(round(amount_paid * fx_to_php, 2)) from orders
          where company_id = ${companyId} and status <> 'cancelled'
            and order_date < ${range.from}::date), 0)::text as in_before,
        coalesce((select sum(round(amount * fx_to_php, 2)) from expenses
          where company_id = ${companyId} and status = 'approved'
            and expense_date < ${range.from}::date), 0)::text as out_before,
        coalesce((select sum(round(amount_paid * fx_to_php, 2)) from orders
          where company_id = ${companyId} and status <> 'cancelled'
            and order_date between ${range.from}::date and ${range.to}::date), 0)::text as in_period,
        coalesce((select sum(round(amount * fx_to_php, 2)) from expenses
          where company_id = ${companyId} and status = 'approved'
            and expense_date between ${range.from}::date and ${range.to}::date), 0)::text as out_period
    `);
    const r = (res as unknown as Record<string, string>[])[0];
    const beginning = Number(r.opening) + Number(r.in_before) - Number(r.out_before);
    const cashIn = Number(r.in_period);
    const cashOut = Number(r.out_period);
    return {
      beginningCash: fmt(beginning),
      cashIn: fmt(cashIn),
      cashOut: fmt(cashOut),
      netChange: fmt(cashIn - cashOut),
      endingCash: fmt(beginning + cashIn - cashOut),
    };
  });
}
