/** Client-safe row shapes for the Settings managers. */

export type CategoryRow = {
  id: string;
  name: string;
  kind: "income" | "cogs" | "expense";
  code: string | null;
};

export type CashAccountRow = {
  id: string;
  name: string;
  type: "bank" | "ewallet" | "cash";
  openingBalance: string;
  currency: string;
};
