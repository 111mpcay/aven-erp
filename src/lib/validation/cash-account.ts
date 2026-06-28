import { z } from "zod";

import { currencyCode, nonNegativeMoney } from "./money";

export const CASH_ACCOUNT_TYPES = ["bank", "ewallet", "cash"] as const;

export const CashAccountCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  type: z.enum(CASH_ACCOUNT_TYPES),
  openingBalance: nonNegativeMoney.default("0"),
  currency: currencyCode,
});

export const CashAccountUpdateSchema = CashAccountCreateSchema.extend({
  id: z.string().uuid(),
});

export type CashAccountCreateInput = z.infer<typeof CashAccountCreateSchema>;
export type CashAccountUpdateInput = z.infer<typeof CashAccountUpdateSchema>;
