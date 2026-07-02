import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * lib/ai — server-only Claude integration (Phase 8).
 *
 * The API key lives in ANTHROPIC_API_KEY (server context only — never a
 * NEXT_PUBLIC var, never sent to the browser). Every feature degrades
 * gracefully: when the key is unset, isAiEnabled() is false and callers hide
 * the AI affordances entirely. All calls run inside Server Actions / RSCs.
 */

// Default per the Claude API guidance; override with ANTHROPIC_MODEL (e.g.
// claude-haiku-4-5) for cheaper/faster classification at higher volume.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";

export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  return (client ??= new Anthropic());
}

/** Extract the first text block, or "" — guards the refusal stop reason. */
function firstText(message: Anthropic.Message): string {
  if (message.stop_reason === "refusal") return "";
  for (const block of message.content) {
    if (block.type === "text") return block.text;
  }
  return "";
}

export type CategoryChoice = { id: string; name: string; kind: string };
export type CategorySuggestion = {
  categoryId: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

/**
 * Suggest the best-fit expense category from the company's OWN categories.
 * Returns null categoryId when nothing fits. The model can only choose from the
 * provided ids (enum-constrained), so the result is always a real category or
 * null — the caller still confirms before saving.
 */
export async function suggestCategory(
  input: { vendor?: string | null; description?: string | null; amount: string },
  categories: CategoryChoice[],
): Promise<CategorySuggestion> {
  if (categories.length === 0) {
    return { categoryId: null, confidence: "low", reason: "No categories exist yet." };
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["categoryId", "confidence", "reason"],
    properties: {
      categoryId: {
        type: "string",
        enum: [...categories.map((c) => c.id), "none"],
        description: "The chosen category id, or 'none' if nothing fits.",
      },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      reason: { type: "string", description: "One short sentence, plain English." },
    },
  };

  const catalog = categories
    .map((c) => `- ${c.id} :: ${c.name} (${c.kind})`)
    .join("\n");

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 300,
    system:
      "You categorize business expenses for a Philippine SME. Choose the single best-fit category from the provided list, matching on vendor and description. If none is a reasonable fit, choose 'none'. Never invent a category id.",
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Categories (id :: name (kind)):\n${catalog}\n\nExpense:\nVendor: ${
          input.vendor || "(none)"
        }\nDescription: ${input.description || "(none)"}\nAmount: PHP ${input.amount}`,
      },
    ],
  });

  const raw = firstText(message);
  if (!raw) return { categoryId: null, confidence: "low", reason: "No suggestion available." };
  try {
    const parsed = JSON.parse(raw) as CategorySuggestion;
    const valid =
      parsed.categoryId && categories.some((c) => c.id === parsed.categoryId);
    return {
      categoryId: valid ? parsed.categoryId : null,
      confidence: parsed.confidence ?? "low",
      reason: parsed.reason ?? "",
    };
  } catch {
    return { categoryId: null, confidence: "low", reason: "Could not parse suggestion." };
  }
}

export type CashflowFlag = { severity: "info" | "warning"; text: string };
export type CashflowInsights = { summary: string; flags: CashflowFlag[] };

/**
 * Narrate the cashflow numbers already computed by lib/cashflow. The model is
 * told to comment ONLY on the provided figures (no fabrication).
 */
export async function generateCashflowInsights(data: {
  companyName: string;
  from: string;
  to: string;
  kpis: { cashOnHand: string; inflow: string; outflow: string; net: string; runwayMonths: string | null };
  series: { day: string; inflow: string; outflow: string }[];
  accounts: { name: string; balance: string }[];
}): Promise<CashflowInsights> {
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["summary", "flags"],
    properties: {
      summary: { type: "string", description: "2-3 plain-English sentences." },
      flags: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["severity", "text"],
          properties: {
            severity: { type: "string", enum: ["info", "warning"] },
            text: { type: "string" },
          },
        },
      },
    },
  };

  const message = await getClient().messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      "You are a cashflow analyst for a Philippine SME. Given a period's cashflow figures, write a concise plain-English summary (2-3 sentences) and up to 4 insight/anomaly flags (severity 'warning' for things needing attention like negative net or low runway, else 'info'). All amounts are Philippine pesos. Comment ONLY on the numbers provided — never invent figures or trends you cannot see. Be specific and useful to a non-technical owner.",
    output_config: { format: { type: "json_schema", schema } },
    messages: [
      {
        role: "user",
        content: `Company: ${data.companyName}\nPeriod: ${data.from} to ${data.to}\nKPIs (PHP): cash on hand ${data.kpis.cashOnHand}, inflow ${data.kpis.inflow}, outflow ${data.kpis.outflow}, net ${data.kpis.net}, runway ${
          data.kpis.runwayMonths ? `${data.kpis.runwayMonths} months` : "not burning"
        }\nAccounts: ${data.accounts.map((a) => `${a.name}=${a.balance}`).join(", ")}\nDaily series (day,inflow,outflow): ${data.series
          .map((p) => `${p.day}:${p.inflow}/${p.outflow}`)
          .join(" ")}`,
      },
    ],
  });

  const raw = firstText(message);
  if (!raw) return { summary: "No insights available.", flags: [] };
  try {
    const parsed = JSON.parse(raw) as CashflowInsights;
    return {
      summary: parsed.summary ?? "",
      flags: Array.isArray(parsed.flags) ? parsed.flags.slice(0, 4) : [],
    };
  } catch {
    return { summary: "Could not generate insights.", flags: [] };
  }
}
