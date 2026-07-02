"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type Point = { day: string; inflow: string; outflow: string };
type Account = {
  name: string;
  type: string;
  openingBalance: string;
  inflow: string;
  outflow: string;
  balance: string;
};

/**
 * CSV-escape a cell. Cells starting with =, +, -, @, tab, or CR get a leading
 * apostrophe so Excel/Sheets treat them as text, not formulas (CSV injection —
 * account/company names are user-entered). Then standard quote-wrapping.
 */
const esc = (v: string) => {
  const guarded = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

/**
 * Client-side CSV of the current dashboard view (no extra endpoint to secure or
 * rate-limit — the data is already on the page). Headers are Google Sheets-
 * compatible per CLAUDE.md.
 */
export function ExportCsvButton({
  series,
  accounts,
  from,
  to,
  companyName,
}: {
  series: Point[];
  accounts: Account[];
  from: string;
  to: string;
  companyName: string;
}) {
  const download = () => {
    const lines: string[] = [];
    lines.push(`Cashflow Export,${esc(companyName)},${from} to ${to}`);
    lines.push("");
    lines.push("Date,Inflow,Outflow,Net");
    for (const p of series) {
      const net = (Number(p.inflow) - Number(p.outflow)).toFixed(2);
      lines.push(`${p.day},${p.inflow},${p.outflow},${net}`);
    }
    lines.push("");
    lines.push("Account,Type,Opening Balance,Inflow,Outflow,Balance");
    for (const a of accounts) {
      lines.push(
        [esc(a.name), a.type, a.openingBalance, a.inflow, a.outflow, a.balance].join(","),
      );
    }
    const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cashflow_${from}_${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download />
      Export CSV
    </Button>
  );
}
