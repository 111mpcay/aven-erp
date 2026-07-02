"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createExpenseAction,
  updateExpenseAction,
  type ActionResult,
} from "./actions";
import type { CategoryOption, AccountOption, EditableExpense } from "./types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const INITIAL: ActionResult = { ok: false };

function todayIso() {
  // Local date as YYYY-MM-DD for the default expense date.
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  categories,
  accounts,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryOption[];
  accounts: AccountOption[];
  editing: EditableExpense | null;
}) {
  const isEdit = editing !== null;
  const action = isEdit ? updateExpenseAction : createExpenseAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  // Derived, not synced: the PIN prompt is open whenever the LATEST action
  // result demands a PIN and the user hasn't dismissed that exact result.
  const [pinDismissed, setPinDismissed] = useState<ActionResult | null>(null);
  const pinOpen = Boolean(state.pinRequired) && pinDismissed !== state;

  // Close on successful save. Depend on the `state` object (a fresh reference on
  // every submit), not `state.ok` — otherwise a 2nd success (ok stays true) would
  // not re-fire the effect and the dialog would stay open.
  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit expense" : "New expense"}</DialogTitle>
          <DialogDescription>
            Record an outflow against a cash account and category.
          </DialogDescription>
        </DialogHeader>

        {/* key forces a fresh form (and cleared file input) per create/edit target */}
        <form
          key={editing?.id ?? "create"}
          ref={formRef}
          action={formAction}
          className="grid gap-3"
        >
          {isEdit && <input type="hidden" name="id" value={editing.id} />}
          {isEdit && (
            <input
              type="hidden"
              name="existingReceiptPath"
              value={editing.receiptPath ?? ""}
            />
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="expenseDate">Date</Label>
            <Input
              id="expenseDate"
              name="expenseDate"
              type="date"
              required
              defaultValue={editing?.expenseDate ?? todayIso()}
            />
            {fe.expenseDate && <FieldError msg={fe.expenseDate} />}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="categoryId">Category</Label>
              <select
                id="categoryId"
                name="categoryId"
                required
                defaultValue={editing?.categoryId ?? ""}
                className={SELECT_CLASS}
              >
                <option value="" disabled>
                  Select…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {fe.categoryId && <FieldError msg={fe.categoryId} />}
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="cashAccountId">Cash account</Label>
              <select
                id="cashAccountId"
                name="cashAccountId"
                required
                defaultValue={editing?.cashAccountId ?? ""}
                className={SELECT_CLASS}
              >
                <option value="" disabled>
                  Select…
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {fe.cashAccountId && <FieldError msg={fe.cashAccountId} />}
            </div>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
                defaultValue={editing?.amount ?? ""}
              />
              {fe.amount && <FieldError msg={fe.amount} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                name="currency"
                defaultValue={editing?.currency ?? "PHP"}
                className={`${SELECT_CLASS} w-24`}
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="fxToPhp">FX→PHP</Label>
              <Input
                id="fxToPhp"
                name="fxToPhp"
                inputMode="decimal"
                className="w-24"
                defaultValue={editing?.fxToPhp ?? "1"}
              />
              {fe.fxToPhp && <FieldError msg={fe.fxToPhp} />}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="vendor">Vendor (optional)</Label>
            <Input
              id="vendor"
              name="vendor"
              defaultValue={editing?.vendor ?? ""}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              name="description"
              rows={2}
              defaultValue={editing?.description ?? ""}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="receipt">
              Receipt {isEdit && editing.receiptPath ? "(replace)" : "(optional)"}
            </Label>
            <Input
              id="receipt"
              name="receipt"
              type="file"
              accept="image/*,application/pdf"
            />
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}

          <DialogFooter className="mt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add expense"}
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

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  );
}
