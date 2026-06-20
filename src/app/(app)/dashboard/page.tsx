import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const KPIS = [
  { label: "Cash on hand", value: "—" },
  { label: "Inflow (period)", value: "—" },
  { label: "Outflow (period)", value: "—" },
  { label: "Net", value: "—" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Cashflow overview. KPIs populate once orders and expenses are recorded
          (Phase 1+).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KPIS.map((k) => (
          <Card key={k.label}>
            <CardHeader className="pb-2">
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{k.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">No data yet</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome to Aven ERP</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Phase 0 skeleton is live: authentication, per-company isolation (RLS +
          RBAC), and the application shell are in place. Orders, expenses,
          cashflow, and accounting reports arrive in the next phases.
        </CardContent>
      </Card>
    </div>
  );
}
