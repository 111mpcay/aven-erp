import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getActiveCompany, requireAuth } from "@/lib/auth/rbac";
import { normalizeRange } from "@/lib/cashflow";
import { formatMoney } from "@/lib/format";
import { getCashflowStatement, getPnlComparison } from "@/lib/reports";
import { DashboardFilters } from "../dashboard/dashboard-filters";
import { ReportActions } from "./report-actions";

type SearchParams = Record<string, string | string[] | undefined>;

/** Signed percent change vs a previous value; null when previous is zero. */
function pctChange(cur: string, prevVal: string): string | null {
  const p = Number(prevVal);
  if (p === 0) return null;
  return (((Number(cur) - p) / Math.abs(p)) * 100).toFixed(1);
}

function Delta({ cur, prev, invert }: { cur: string; prev: string; invert?: boolean }) {
  const pct = pctChange(cur, prev);
  if (pct === null) return <span className="text-xs text-muted-foreground">—</span>;
  const up = Number(pct) >= 0;
  // Cost rows invert the palette: rising COGS/expenses is bad, falling is good.
  const good = invert ? !up : up;
  return (
    <span className={`text-xs tabular-nums ${good ? "text-primary" : "text-destructive"}`}>
      {up ? "+" : ""}
      {pct}%
    </span>
  );
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const { active } = await getActiveCompany();

  if (!active) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any company yet. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  // Normalize HERE (defaults, swap, floor, 366-day clamp) so the header, print
  // title, and CSV always label the exact range the numbers cover — the service
  // re-normalizes the same way as a no-op backstop.
  const { from, to } = normalizeRange({
    from: typeof sp.from === "string" ? sp.from : "",
    to: typeof sp.to === "string" ? sp.to : "",
  });

  const [cmp, statement] = await Promise.all([
    getPnlComparison(active.id, { from, to }),
    getCashflowStatement(active.id, { from, to }),
  ]);
  const { current: pnl, previous: prev, previousRange } = cmp;

  const pnlRows = [
    { label: "Revenue", cur: pnl.revenue, prev: prev.revenue },
    { label: "Cost of goods sold", cur: pnl.cogs, prev: prev.cogs, invert: true },
    { label: "Gross profit", cur: pnl.grossProfit, prev: prev.grossProfit, strong: true },
    { label: "Operating expenses", cur: pnl.totalExpenses, prev: prev.totalExpenses, invert: true },
    { label: "Net profit", cur: pnl.netProfit, prev: prev.netProfit, strong: true },
  ];

  const stmtRows = [
    { label: "Beginning cash", value: statement.beginningCash },
    { label: "Cash in (payments received)", value: statement.cashIn },
    { label: "Cash out (expenses)", value: statement.cashOut },
    { label: "Net change", value: statement.netChange, strong: true },
    { label: "Ending cash", value: statement.endingCash, strong: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {active.name} · confirmed orders + approved expenses · {from} → {to}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DashboardFilters from={from} to={to} />
          <ReportActions
            pnl={pnl}
            prev={prev}
            statement={statement}
            from={from}
            to={to}
            prevFrom={previousRange.from}
            prevTo={previousRange.to}
            companyName={active.name}
          />
        </div>
      </div>

      {/* Print header (hidden on screen) */}
      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">{active.name} — Accounting Report</h1>
        <p className="text-sm">{from} → {to}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profit &amp; Loss</CardTitle>
          <CardDescription>
            vs previous period ({previousRange.from} → {previousRange.to})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Previous</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnlRows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className={r.strong ? "font-semibold" : ""}>{r.label}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${r.strong ? "font-semibold" : ""} ${
                      r.strong && Number(r.cur) < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatMoney(r.cur)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(r.prev)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Delta cur={r.cur} prev={r.prev} invert={r.invert} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Expenses by category</CardTitle>
          <CardDescription>Approved expenses in the period</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">% of expenses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pnl.expensesByCategory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                    No expenses in this period.
                  </TableCell>
                </TableRow>
              ) : (
                pnl.expensesByCategory.map((r) => (
                  <TableRow key={r.id ?? "uncategorized"}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(r.amount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.share}%
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cashflow statement</CardTitle>
          <CardDescription>
            Cash basis — payments received vs expenses paid in the period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {stmtRows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className={r.strong ? "font-semibold" : ""}>{r.label}</TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${r.strong ? "font-semibold" : ""} ${
                      r.strong && Number(r.value) < 0 ? "text-destructive" : ""
                    }`}
                  >
                    {formatMoney(r.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
