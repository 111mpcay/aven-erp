"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";

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
import {
  deleteOrderAction,
  getOrderForEdit,
  type ActionResult,
} from "./actions";
import { OrderFormDialog } from "./order-form-dialog";
import { OrdersTable } from "./orders-table";
import type { AccountOption, EditableOrder, OrderRowView } from "./types";

const INITIAL: ActionResult = { ok: false };

export function OrdersClient({
  rows,
  accounts,
  canWrite,
  canDelete,
}: {
  rows: OrderRowView[];
  accounts: AccountOption[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EditableOrder | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<OrderRowView | null>(null);
  const [loadingEdit, startEdit] = useTransition();

  const openCreate = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setFormOpen(true);
  };

  const openEdit = (row: OrderRowView) => {
    startEdit(async () => {
      const order = await getOrderForEdit(row.id);
      if (order) {
        setEditing(order);
        setFormKey((k) => k + 1);
        setFormOpen(true);
      }
    });
  };

  return (
    <div className="space-y-4">
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={openCreate} disabled={loadingEdit}>
            <Plus />
            New order
          </Button>
        </div>
      )}

      <OrdersTable
        rows={rows}
        canWrite={canWrite}
        canDelete={canDelete}
        onEdit={openEdit}
        onDelete={(row) => setDeleteTarget(row)}
      />

      <OrderFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        accounts={accounts}
        editing={editing}
      />

      <DeleteOrderDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}

function DeleteOrderDialog({
  target,
  onOpenChange,
}: {
  target: OrderRowView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(deleteOrderAction, INITIAL);

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete order?</DialogTitle>
          <DialogDescription>
            {target
              ? `Order ${target.orderNo} (${formatMoney(target.total, target.currency)}) and its line items will be permanently removed.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={target?.id ?? ""} />
          {state.error && (
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
      </DialogContent>
    </Dialog>
  );
}
