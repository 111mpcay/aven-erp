"use client";

import { Download, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

type Pnl = {
  revenue: string;
  cogs: string;
  grossProfit: string;
  expensesByCategory: { label: string; amount: string; share?: string }[];
  totalExpenses: string;
  netProfit: string;
};
type Statement = {
  beginningCash: string;
  cashIn: string;
  cashOut: string;
  netChange: string;
  endingCash: string;
};

/** Formula-injection-safe CSV escaping (same rules as the dashboard export). */
const esc = (v: string) => {
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

export function ReportActions({
  pnl,
  prev,
  statement,
  from,
  to,
  prevFrom,
  prevTo,
  companyName,
}: {
  pnl: Pnl;
  prev: Pnl;
  statement: Statement;
  from: string;
  to: string;
  prevFrom: string;
  prevTo: string;
  companyName: string;
}) {
  const download = () => {
    const L: string[] = [];
    L.push(`Accounting Report,${esc(companyName)},${from} to ${to}`);
    L.push("");
    L.push("Profit & Loss,Current,Previous");
    L.push(`Period,${from} to ${to},${prevFrom} to ${prevTo}`);
    L.push(`Revenue,${pnl.revenue},${prev.revenue}`);
    L.push(`COGS,${pnl.cogs},${prev.cogs}`);
    L.push(`Gross Profit,${pnl.grossProfit},${prev.grossProfit}`);
    L.push(`Total Expenses,${pnl.totalExpenses},${prev.totalExpenses}`);
    L.push(`Net Profit,${pnl.netProfit},${prev.netProfit}`);
    L.push("");
    L.push("Expenses by Category,Amount,% of Expenses");
    for (const r of pnl.expensesByCategory) {
      L.push(`${esc(r.label)},${r.amount},${r.share ?? ""}`);
    }
    L.push("");
    L.push("Cashflow Statement,Amount");
    L.push(`Beginning Cash,${statement.beginningCash}`);
    L.push(`Cash In,${statement.cashIn}`);
    L.push(`Cash Out,${statement.cashOut}`);
    L.push(`Net Change,${statement.netChange}`);
    L.push(`Ending Cash,${statement.endingCash}`);

    const blob = new Blob([L.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `report_${from}_${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={download}>
        <Download />
        Export CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer />
        Print / PDF
      </Button>
    </div>
  );
}
