"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { PinPrompt } from "@/components/pin-prompt";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { deleteExpenseAction, type ActionResult } from "./actions";
import { ExpenseFormDialog } from "./expense-form-dialog";
import { ExpensesTable } from "./expenses-table";
import type {
  AccountOption,
  CategoryOption,
  EditableExpense,
  ExpenseRowView,
} from "./types";

const INITIAL: ActionResult = { ok: false };

function toEditable(row: ExpenseRowView): EditableExpense {
  return {
    id: row.id,
    expenseDate: row.expenseDate,
    categoryId: row.categoryId,
    cashAccountId: row.cashAccountId,
    amount: row.amount,
    currency: row.currency,
    fxToPhp: row.fxToPhp,
    vendor: row.vendor,
    description: row.description,
    receiptPath: row.receiptPath,
  };
}

export function ExpensesClient({
  rows,
  categories,
  accounts,
  canWrite,
  canDelete,
}: {
  rows: ExpenseRowView[];
  categories: CategoryOption[];
  accounts: AccountOption[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableExpense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRowView | null>(null);

  const noCatalog = categories.length === 0 || accounts.length === 0;

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            disabled={noCatalog}
            title={
              noCatalog
                ? "Add a cash account and category in Settings first"
                : undefined
            }
          >
            <Plus />
            New expense
          </Button>
        </div>
      )}

      {noCatalog && canWrite && (
        <p className="text-sm text-muted-foreground">
          You need at least one cash account and one category before logging an
          expense. Add them in <strong>Settings</strong> (or run the seed).
        </p>
      )}

      <ExpensesTable
        rows={rows}
        canWrite={canWrite}
        canDelete={canDelete}
        onEdit={(row) => {
          setEditing(toEditable(row));
          setFormOpen(true);
        }}
        onDelete={(row) => setDeleteTarget(row)}
      />

      <ExpenseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        categories={categories}
        accounts={accounts}
        editing={editing}
      />

      <DeleteExpenseDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}

function DeleteExpenseDialog({
  target,
  onOpenChange,
}: {
  target: ExpenseRowView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    deleteExpenseAction,
    INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);
  // Derived: prompt is open while the latest result demands a PIN, undismissed.
  const [pinDismissed, setPinDismissed] = useState<ActionResult | null>(null);
  const pinOpen = Boolean(state.pinRequired) && pinDismissed !== state;

  // Depend on `state` (fresh ref per submit), not `state.ok`, so repeated
  // successes re-fire the effect and close the dialog each time.
  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete expense?</DialogTitle>
          <DialogDescription>
            {target
              ? `This permanently removes the ${formatMoney(
                  target.amount,
                  target.currency,
                )} expense${target.vendor ? ` to ${target.vendor}` : ""}. This cannot be undone.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction}>
          <input type="hidden" name="id" value={target?.id ?? ""} />
          {state.error && !state.pinRequired && (
            <p className="mb-2 text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </form>

        <PinPrompt
          open={pinOpen}
          onOpenChange={(open) => {
            if (!open) setPinDismissed(state);
          }}
          onVerified={() => formRef.current?.requestSubmit()}
        />
      </DialogContent>
    </Dialog>
  );
}
