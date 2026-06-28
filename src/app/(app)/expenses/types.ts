/** Client-safe shapes shared across the Expenses UI (no server imports). */

export type CategoryOption = {
  id: string;
  name: string;
  kind: "income" | "cogs" | "expense";
};

export type AccountOption = {
  id: string;
  name: string;
  type: "bank" | "ewallet" | "cash";
};

/** Row shape rendered in the expenses table (mirrors lib/ledger ExpenseRow). */
export type ExpenseRowView = {
  id: string;
  expenseDate: string;
  vendor: string | null;
  description: string | null;
  amount: string;
  currency: string;
  fxToPhp: string;
  status: "draft" | "approved";
  source: "manual" | "meta_ads" | "import" | "recurring";
  receiptPath: string | null;
  categoryId: string | null;
  categoryName: string | null;
  cashAccountId: string | null;
  cashAccountName: string | null;
};

/** Fields the create/edit form needs to prefill when editing a row. */
export type EditableExpense = {
  id: string;
  expenseDate: string;
  categoryId: string | null;
  cashAccountId: string | null;
  amount: string;
  currency: string;
  fxToPhp: string;
  vendor: string | null;
  description: string | null;
  receiptPath: string | null;
};
