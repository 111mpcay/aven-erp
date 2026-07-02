"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import {
  createCashAccountAction,
  deleteCashAccountAction,
  updateCashAccountAction,
  type ActionResult,
} from "./actions";
import type { CashAccountRow } from "./types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const INITIAL: ActionResult = { ok: false };
const TYPE_LABELS: Record<CashAccountRow["type"], string> = {
  bank: "Bank",
  ewallet: "E-wallet",
  cash: "Cash",
};

export function CashAccountsManager({
  accounts,
  canWrite,
  canDelete,
}: {
  accounts: CashAccountRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CashAccountRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CashAccountRow | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium">Cash accounts</h2>
          <p className="text-sm text-muted-foreground">
            Where money sits — bank, e-wallet (GCash/Maya), and cash on hand.
          </p>
        </div>
        {canWrite && (
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus />
            Add
          </Button>
        )}
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Opening balance</TableHead>
              {(canWrite || canDelete) && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                  No cash accounts yet.
                </TableCell>
              </TableRow>
            ) : (
              accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>{TYPE_LABELS[a.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(a.openingBalance, a.currency)}
                  </TableCell>
                  {(canWrite || canDelete) && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit account"
                            onClick={() => {
                              setEditing(a);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete account"
                            onClick={() => setDeleteTarget(a)}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AccountFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
      <DeleteDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}

function AccountFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CashAccountRow | null;
}) {
  const isEdit = editing !== null;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateCashAccountAction : createCashAccountAction,
    INITIAL,
  );
  // Depend on `state` (fresh ref per submit), not `state.ok`, so repeated
  // successes re-fire the effect and close the dialog each time.
  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);
  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit account" : "New cash account"}</DialogTitle>
          <DialogDescription>Track each place money is held separately.</DialogDescription>
        </DialogHeader>
        <form key={editing?.id ?? "create"} action={formAction} className="grid gap-3">
          {isEdit && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid gap-1.5">
            <Label htmlFor="acc-name">Name</Label>
            <Input id="acc-name" name="name" required defaultValue={editing?.name ?? ""} />
            {fe.name && <FieldError msg={fe.name} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="acc-type">Type</Label>
              <select
                id="acc-type"
                name="type"
                defaultValue={editing?.type ?? "bank"}
                className={SELECT_CLASS}
              >
                <option value="bank">Bank</option>
                <option value="ewallet">E-wallet</option>
                <option value="cash">Cash</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acc-currency">Currency</Label>
              <select
                id="acc-currency"
                name="currency"
                defaultValue={editing?.currency ?? "PHP"}
                className={SELECT_CLASS}
              >
                <option value="PHP">PHP</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="acc-opening">Opening balance</Label>
            <Input
              id="acc-opening"
              name="openingBalance"
              inputMode="decimal"
              defaultValue={editing?.openingBalance ?? "0"}
            />
            {fe.openingBalance && <FieldError msg={fe.openingBalance} />}
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  onOpenChange,
}: {
  target: CashAccountRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(deleteCashAccountAction, INITIAL);
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
          <DialogTitle>Delete account?</DialogTitle>
          <DialogDescription>
            {target ? `"${target.name}" will be removed. Accounts used by expenses can't be deleted.` : ""}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
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

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  );
}
