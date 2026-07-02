import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db/rls";
import { isValidIsoDate, manilaDateDaysAgo } from "@/lib/format";

/**
 * lib/cashflow — DERIVED cashflow (CLAUDE.md: users never enter ledger lines).
 *
 * Inflow  = orders.amount_paid × fx_to_php (status ≠ cancelled), dated order_date.
 * Outflow = expenses.amount × fx_to_php (status = approved), dated expense_date.
 * Balance per account = opening_balance + inflows − outflows (all-time).
 *
 * Everything is aggregated in SQL under the caller's RLS transaction, rounded
 * to centavos (2dp) per the money convention, and returned as decimal strings.
 * Posted `ledger_entries` + materialized views replace these live aggregates in
 * Phase 4 without changing callers.
 */

export type DailyPoint = { day: string; inflow: string; outflow: string };
export type AccountBalance = {
  id: string;
  name: string;
  type: "bank" | "ewallet" | "cash";
  openingBalance: string;
  inflow: string;
  outflow: string;
  balance: string;
};
export type CashflowKpis = {
  cashOnHand: string;
  inflow: string;
  outflow: string;
  net: string;
  /** Months of cash left at the trailing-90-day net burn; null when not burning. */
  runwayMonths: string | null;
};
export type CashflowSummary = {
  series: DailyPoint[];
  accounts: AccountBalance[];
  kpis: CashflowKpis;
};

const centavos = (n: number) => (Math.round(n * 100) / 100).toFixed(2);

/** Hard cap on the series span — generate_series is synthetic, so an unclamped
 *  range (e.g. 0001-01-01…9999-12-31) would materialize ~3.65M rows per request
 *  regardless of RLS. Callers should clamp too; this is the backstop. */
const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

export function normalizeRange(range: { from: string; to: string }) {
  let from = isValidIsoDate(range.from) ? range.from : manilaDateDaysAgo(29);
  let to = isValidIsoDate(range.to) ? range.to : manilaDateDaysAgo(0);
  if (from > to) [from, to] = [to, from];
  // Floor to a sane epoch: derived previous-period math must never produce a
  // year-0000 date (JS has year 0, Postgres does not → 22008 on ::date).
  const MIN_DATE = "1900-01-01";
  if (from < MIN_DATE) from = MIN_DATE;
  if (to < MIN_DATE) to = MIN_DATE;
  const spanDays = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
  if (spanDays > MAX_RANGE_DAYS) {
    from = new Date(Date.parse(`${to}T00:00:00Z`) - MAX_RANGE_DAYS * DAY_MS)
      .toISOString()
      .slice(0, 10);
  }
  return { from, to };
}

export async function getCashflowSummary(
  companyId: string,
  rawRange: { from: string; to: string },
): Promise<CashflowSummary> {
  const range = normalizeRange(rawRange);
  // Manila-local "today" bounds the burn window (server clock may be UTC).
  const today = manilaDateDaysAgo(0);
  const db = await getDb();
  return db.rls(async (tx) => {
    // Daily inflow/outflow across the range (zero-filled via generate_series).
    // Money convention (matches lib/orders): round per TRANSACTION to centavos,
    // then sum — so every partition (day, account, period) ties exactly.
    const seriesRes = await tx.execute(sql`
      with days as (
        select generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date as day
      ),
      inflows as (
        select order_date as day, sum(round(amount_paid * fx_to_php, 2)) as inflow
        from orders
        where company_id = ${companyId} and status <> 'cancelled'
          and order_date between ${range.from}::date and ${range.to}::date
        group by order_date
      ),
      outflows as (
        select expense_date as day, sum(round(amount * fx_to_php, 2)) as outflow
        from expenses
        where company_id = ${companyId} and status = 'approved'
          and expense_date between ${range.from}::date and ${range.to}::date
        group by expense_date
      )
      select d.day::text as day,
             round(coalesce(i.inflow, 0), 2)::text as inflow,
             round(coalesce(o.outflow, 0), 2)::text as outflow
      from days d
      left join inflows i on i.day = d.day
      left join outflows o on o.day = d.day
      order by d.day
    `);
    const series = seriesRes as unknown as DailyPoint[];

    // All-time balance per cash account.
    const accountsRes = await tx.execute(sql`
      select a.id, a.name, a.type,
             a.opening_balance::text as "openingBalance",
             round(coalesce(i.total, 0), 2)::text as inflow,
             round(coalesce(o.total, 0), 2)::text as outflow,
             round(a.opening_balance + coalesce(i.total, 0) - coalesce(o.total, 0), 2)::text as balance
      from cash_accounts a
      left join (
        select cash_account_id, sum(round(amount_paid * fx_to_php, 2)) as total
        from orders where company_id = ${companyId} and status <> 'cancelled'
        group by cash_account_id
      ) i on i.cash_account_id = a.id
      left join (
        select cash_account_id, sum(round(amount * fx_to_php, 2)) as total
        from expenses where company_id = ${companyId} and status = 'approved'
        group by cash_account_id
      ) o on o.cash_account_id = a.id
      where a.company_id = ${companyId}
      order by a.name
    `);
    const accounts = accountsRes as unknown as AccountBalance[];

    // Trailing 90-day net for the runway estimate — bounded on both ends so
    // future-dated entries don't skew the burn, anchored to Manila "today".
    const burnRes = await tx.execute(sql`
      select
        coalesce((select sum(round(amount_paid * fx_to_php, 2)) from orders
          where company_id = ${companyId} and status <> 'cancelled'
            and order_date between ${today}::date - 90 and ${today}::date), 0)::text as inflow90,
        coalesce((select sum(round(amount * fx_to_php, 2)) from expenses
          where company_id = ${companyId} and status = 'approved'
            and expense_date between ${today}::date - 90 and ${today}::date), 0)::text as outflow90
    `);
    const burn = (burnRes as unknown as { inflow90: string; outflow90: string }[])[0];

    const inflow = series.reduce((s, p) => s + Number(p.inflow), 0);
    const outflow = series.reduce((s, p) => s + Number(p.outflow), 0);
    const cashOnHand = accounts.reduce((s, a) => s + Number(a.balance), 0);

    // null strictly means "not burning"; burning with no cash left is "0.0".
    const monthlyNet = (Number(burn.inflow90) - Number(burn.outflow90)) / 3;
    const runwayMonths =
      monthlyNet < 0
        ? cashOnHand > 0
          ? (cashOnHand / Math.abs(monthlyNet)).toFixed(1)
          : "0.0"
        : null;

    return {
      series,
      accounts,
      kpis: {
        cashOnHand: centavos(cashOnHand),
        inflow: centavos(inflow),
        outflow: centavos(outflow),
        net: centavos(inflow - outflow),
        runwayMonths,
      },
    };
  });
}
