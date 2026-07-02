"use client";

import { AlertTriangle, Info, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";

import { generateInsightsAction } from "@/app/(app)/ai-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CashflowInsights } from "@/lib/ai";

/**
 * On-demand AI cashflow insights. User-initiated (a button, not every page
 * load) so the paid call only runs when asked. Rendered only when AI is enabled.
 */
export function CashflowInsightsCard({ from, to }: { from: string; to: string }) {
  const [insights, setInsights] = useState<CashflowInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      setError(null);
      const res = await generateInsightsAction(from, to);
      if (res.ok && res.insights) setInsights(res.insights);
      else setError(res.error ?? "Failed to generate insights.");
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" />
              AI insights
            </CardTitle>
            <CardDescription>
              Plain-English read of this period&apos;s cashflow
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={run} disabled={pending}>
            {pending ? "Analyzing…" : insights ? "Regenerate" : "Generate insights"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!error && !insights && !pending && (
          <p className="text-sm text-muted-foreground">
            Generate an AI summary and anomaly flags for the selected date range.
          </p>
        )}
        {insights && (
          <div className="space-y-3">
            <p className="text-sm">{insights.summary}</p>
            {insights.flags.length > 0 && (
              <ul className="space-y-1.5">
                {insights.flags.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {f.severity === "warning" ? (
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                    ) : (
                      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span>{f.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[11px] text-muted-foreground">
              AI-generated from your figures. Verify before acting.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
