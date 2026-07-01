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
import { getCashflowSummary } from "@/lib/cashflow";
import { formatMoney, isValidIsoDate, manilaDateDaysAgo } from "@/lib/format";
import { CashflowChart } from "./cashflow-chart";
import { DashboardFilters } from "./dashboard-filters";
import { ExportCsvButton } from "./export-csv-button";

type SearchParams = Record<string, string | string[] | undefined>;

const MAX_RANGE_DAYS = 366;
const DAY_MS = 86_400_000;

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: "Bank",
  ewallet: "E-wallet",
  cash: "Cash",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAuth();
  const { active } = await getActiveCompany();

  if (!active) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any company yet. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const sp = await searchParams;
  const rawFrom = typeof sp.from === "string" ? sp.from : "";
  const rawTo = typeof sp.to === "string" ? sp.to : "";
  // Semantic validation (rejects 2026-02-31), Manila-local defaults, and a
  // span clamp — the service re-clamps as the backstop.
  let from = isValidIsoDate(rawFrom) ? rawFrom : manilaDateDaysAgo(29);
  let to = isValidIsoDate(rawTo) ? rawTo : manilaDateDaysAgo(0);
  if (from > to) [from, to] = [to, from];
  if ((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS > MAX_RANGE_DAYS) {
    from = new Date(Date.parse(`${to}T00:00:00Z`) - MAX_RANGE_DAYS * DAY_MS)
      .toISOString()
      .slice(0, 10);
  }

  const { series, accounts, kpis } = await getCashflowSummary(active.id, { from, to });

  const kpiCards = [
    { label: "Cash on hand", value: formatMoney(kpis.cashOnHand), hint: "All accounts, all time" },
    { label: "Inflow (period)", value: formatMoney(kpis.inflow), hint: `${from} → ${to}` },
    { label: "Outflow (period)", value: formatMoney(kpis.outflow), hint: `${from} → ${to}` },
    {
      label: "Net (period)",
      value: formatMoney(kpis.net),
      hint: kpis.runwayMonths ? `Runway ≈ ${kpis.runwayMonths} months` : "Not burning cash",
      negative: Number(kpis.net) < 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {active.name} · cashflow derived from orders &amp; expenses
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <DashboardFilters from={from} to={to} />
          <ExportCsvButton
            series={series}
            accounts={accounts}
            from={from}
            to={to}
            companyName={active.name}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardDescription>{k.label}</CardDescription>
              <CardTitle
                className={`text-2xl tabular-nums ${k.negative ? "text-destructive" : ""}`}
              >
                {k.value}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{k.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cashflow trend</CardTitle>
          <CardDescription>
            Daily inflow vs outflow with net, {from} → {to}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowChart series={series} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account balances</CardTitle>
          <CardDescription>
            Opening balance + all-time inflows − outflows, per cash account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Opening</TableHead>
                <TableHead className="text-right">Inflow</TableHead>
                <TableHead className="text-right">Outflow</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                    No cash accounts yet — add them in Settings.
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{ACCOUNT_TYPE_LABELS[a.type] ?? a.type}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(a.openingBalance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(a.inflow)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(a.outflow)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-medium tabular-nums ${
                        Number(a.balance) < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatMoney(a.balance)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
