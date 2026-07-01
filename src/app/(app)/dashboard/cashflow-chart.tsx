"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/lib/format";

type Point = { day: string; inflow: string; outflow: string };

const TEAL = "#0F766E"; // brand teal — inflow
const CHARCOAL = "#1F2937"; // brand charcoal — net line
const RED = "#DC2626"; // outflow

export function CashflowChart({ series }: { series: Point[] }) {
  // Keep the full ISO date in the datum: the axis shows compact MM-DD via
  // tickFormatter, but the tooltip shows the full date so ranges crossing a
  // year boundary stay unambiguous.
  const data = series.map((p) => {
    const inflow = Number(p.inflow);
    const outflow = Number(p.outflow);
    return {
      day: p.day,
      inflow,
      outflow,
      net: Math.round((inflow - outflow) * 100) / 100,
    };
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tickFormatter={(d: string) => d.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={70}
            tickFormatter={(v: number) =>
              new Intl.NumberFormat("en-PH", { notation: "compact" }).format(v)
            }
          />
          <Tooltip
            formatter={(value, name) => [formatMoney(Number(value ?? 0)), String(name)]}
            labelFormatter={(label) => String(label)}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Bar dataKey="inflow" name="Inflow" fill={TEAL} radius={[3, 3, 0, 0]} maxBarSize={18} />
          <Bar dataKey="outflow" name="Outflow" fill={RED} radius={[3, 3, 0, 0]} maxBarSize={18} opacity={0.75} />
          <Line dataKey="net" name="Net" stroke={CHARCOAL} strokeWidth={2} dot={false} type="monotone" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
