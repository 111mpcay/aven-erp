import { z } from "zod";

import { currencyCode, fxRate, isoDate, positiveMoney } from "./money";

/**
 * One Zod schema per form (CLAUDE.md): drives client validation AND is
 * re-validated server-side in the Server Action, with the inferred type used
 * end to end. The manual expense form requires a category + cash account (the
 * Phase 1 "log an expense against an account + category" criterion); the DB
 * columns stay nullable so non-manual sources (import, Meta Ads) can omit them.
 */
export const ExpenseCreateSchema = z.object({
  expenseDate: isoDate,
  categoryId: z.string().uuid("Pick a category"),
  cashAccountId: z.string().uuid("Pick a cash account"),
  vendor: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  amount: positiveMoney,
  currency: currencyCode,
  fxToPhp: fxRate,
  receiptPath: z.string().trim().max(512).optional(),
});

export const ExpenseUpdateSchema = ExpenseCreateSchema.extend({
  id: z.string().uuid(),
});

export type ExpenseCreateInput = z.infer<typeof ExpenseCreateSchema>;
export type ExpenseUpdateInput = z.infer<typeof ExpenseUpdateSchema>;
