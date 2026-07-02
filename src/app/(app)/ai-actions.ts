"use server";

import { getActiveCompany, requireRole, WRITE_ROLES } from "@/lib/auth/rbac";
import {
  generateCashflowInsights,
  isAiEnabled,
  suggestCategory,
  type CashflowInsights,
  type CategorySuggestion,
} from "@/lib/ai";
import { listCategories } from "@/lib/catalog";
import { getCashflowSummary } from "@/lib/cashflow";
import { isValidIsoDate, manilaDateDaysAgo } from "@/lib/format";

export type SuggestResult = {
  ok: boolean;
  suggestion?: CategorySuggestion & { categoryName?: string | null };
  error?: string;
};

/** Suggest a category for an in-progress expense (write-role users only). */
export async function suggestCategoryAction(input: {
  vendor?: string;
  description?: string;
  amount?: string;
}): Promise<SuggestResult> {
  if (!isAiEnabled()) return { ok: false, error: "AI is not configured." };
  const ctx = await requireRole(WRITE_ROLES);

  const categories = await listCategories(ctx.companyId);
  try {
    const suggestion = await suggestCategory(
      {
        vendor: input.vendor ?? null,
        description: input.description ?? null,
        amount: input.amount || "0",
      },
      categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
    );
    const categoryName =
      categories.find((c) => c.id === suggestion.categoryId)?.name ?? null;
    return { ok: true, suggestion: { ...suggestion, categoryName } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Suggestion failed." };
  }
}

export type InsightsResult = { ok: boolean; insights?: CashflowInsights; error?: string };

/** Generate cashflow insights for the active company over a date range. */
export async function generateInsightsAction(
  from: string,
  to: string,
): Promise<InsightsResult> {
  if (!isAiEnabled()) return { ok: false, error: "AI is not configured." };
  const { active } = await getActiveCompany();
  if (!active) return { ok: false, error: "No active company." };

  const range = {
    from: isValidIsoDate(from) ? from : manilaDateDaysAgo(29),
    to: isValidIsoDate(to) ? to : manilaDateDaysAgo(0),
  };

  try {
    const summary = await getCashflowSummary(active.id, range);
    const insights = await generateCashflowInsights({
      companyName: active.name,
      from: range.from,
      to: range.to,
      kpis: summary.kpis,
      series: summary.series,
      accounts: summary.accounts.map((a) => ({ name: a.name, balance: a.balance })),
    });
    return { ok: true, insights };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Insights failed." };
  }
}
