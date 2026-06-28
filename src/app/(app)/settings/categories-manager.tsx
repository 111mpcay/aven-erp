"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

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
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
  type ActionResult,
} from "./actions";
import type { CategoryRow } from "./types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const INITIAL: ActionResult = { ok: false };
const KIND_LABELS: Record<CategoryRow["kind"], string> = {
  income: "Income",
  cogs: "COGS",
  expense: "Expense",
};

export function CategoriesManager({
  categories,
  canWrite,
  canDelete,
}: {
  categories: CategoryRow[];
  canWrite: boolean;
  canDelete: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryRow | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Chart of accounts used to classify income, COGS, and expenses.
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
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Kind</TableHead>
              {(canWrite || canDelete) && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-16 text-center text-muted-foreground">
                  No categories yet.
                </TableCell>
              </TableRow>
            ) : (
              categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {c.code || "—"}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{KIND_LABELS[c.kind]}</TableCell>
                  {(canWrite || canDelete) && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {canWrite && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Edit category"
                            onClick={() => {
                              setEditing(c);
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
                            aria-label="Delete category"
                            onClick={() => setDeleteTarget(c)}
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

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
      <DeleteDialog
        target={deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}

function CategoryFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CategoryRow | null;
}) {
  const isEdit = editing !== null;
  const [state, formAction, pending] = useActionState(
    isEdit ? updateCategoryAction : createCategoryAction,
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
          <DialogTitle>{isEdit ? "Edit category" : "New category"}</DialogTitle>
          <DialogDescription>Group expenses and income for reporting.</DialogDescription>
        </DialogHeader>
        <form key={editing?.id ?? "create"} action={formAction} className="grid gap-3">
          {isEdit && <input type="hidden" name="id" value={editing.id} />}
          <div className="grid gap-1.5">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" name="name" required defaultValue={editing?.name ?? ""} />
            {fe.name && <FieldError msg={fe.name} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cat-kind">Kind</Label>
              <select
                id="cat-kind"
                name="kind"
                defaultValue={editing?.kind ?? "expense"}
                className={SELECT_CLASS}
              >
                <option value="expense">Expense</option>
                <option value="cogs">COGS</option>
                <option value="income">Income</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cat-code">Code (optional)</Label>
              <Input id="cat-code" name="code" defaultValue={editing?.code ?? ""} />
            </div>
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
  target: CategoryRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(deleteCategoryAction, INITIAL);
  // Depend on `state` (fresh ref per submit), not `state.ok`, so repeated
  // successes re-fire the effect and close the dialog each time.
  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete category?</DialogTitle>
          <DialogDescription>
            {target ? `"${target.name}" will be removed. Categories in use by expenses can't be deleted.` : ""}
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
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

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  );
}
