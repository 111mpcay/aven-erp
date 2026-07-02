"use client";

import { AlertTriangle, PackageCheck, Pencil } from "lucide-react";
import { useActionState, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
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
import { formatDate, formatMoney } from "@/lib/format";
import { updateFulfillmentAction, type ActionResult } from "./actions";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const INITIAL: ActionResult = { ok: false };

const STATUSES = ["pending", "packed", "shipped", "in_transit", "delivered"] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABELS: Record<Status, string> = {
  pending: "Pending",
  packed: "Packed",
  shipped: "Shipped",
  in_transit: "In transit",
  delivered: "Delivered",
};
const STATUS_VARIANT: Record<Status, "default" | "secondary" | "outline"> = {
  pending: "outline",
  packed: "outline",
  shipped: "secondary",
  in_transit: "secondary",
  delivered: "default",
};

export type LogisticsRowView = {
  id: string;
  orderNo: string;
  customerName: string | null;
  orderDate: string;
  fulfillmentStatus: Status | null;
  courier: string | null;
  trackingNo: string | null;
  shippingCost: string | null;
  delayed: boolean;
};

export function LogisticsClient({
  rows,
  canWrite,
}: {
  rows: LogisticsRowView[];
  canWrite: boolean;
}) {
  const [editing, setEditing] = useState<LogisticsRowView | null>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <div className="space-y-3">
      {/* Mobile-first: cards on narrow screens, a table from sm up. */}
      <div className="grid gap-2 sm:hidden">
        {rows.length === 0 && (
          <p className="rounded-xl border p-4 text-center text-sm text-muted-foreground">
            No orders to fulfill.
          </p>
        )}
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={!canWrite}
            onClick={() => {
              setEditing(r);
              setFormKey((k) => k + 1);
            }}
            className="flex flex-col gap-1 rounded-xl border p-3 text-left disabled:opacity-70"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.orderNo}</span>
              <StatusBadge status={r.fulfillmentStatus} delayed={r.delayed} />
            </div>
            <span className="text-sm text-muted-foreground">
              {r.customerName || "—"} · {formatDate(r.orderDate)}
            </span>
            {(r.courier || r.trackingNo) && (
              <span className="text-xs text-muted-foreground">
                {r.courier} {r.trackingNo}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border sm:block">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="p-2 font-medium">Order</th>
              <th className="p-2 font-medium">Customer</th>
              <th className="p-2 font-medium">Status</th>
              <th className="p-2 font-medium">Courier / Tracking</th>
              <th className="p-2 text-right font-medium">Shipping</th>
              {canWrite && <th className="p-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="h-16 text-center text-muted-foreground">
                  No orders to fulfill.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                  <td className="p-2 font-medium">{r.orderNo}</td>
                  <td className="p-2">{r.customerName || "—"}</td>
                  <td className="p-2">
                    <StatusBadge status={r.fulfillmentStatus} delayed={r.delayed} />
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {r.courier || "—"} {r.trackingNo}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {r.shippingCost ? formatMoney(r.shippingCost) : "—"}
                  </td>
                  {canWrite && (
                    <td className="p-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Update fulfillment"
                        onClick={() => {
                          setEditing(r);
                          setFormKey((k) => k + 1);
                        }}
                      >
                        <Pencil />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canWrite && (
        <FulfillmentDialog
          key={formKey}
          row={editing}
          onOpenChange={(open) => !open && setEditing(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status, delayed }: { status: Status | null; delayed: boolean }) {
  const s = status ?? "pending";
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={STATUS_VARIANT[s]}>{STATUS_LABELS[s]}</Badge>
      {delayed && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="size-3" />
          Delayed
        </Badge>
      )}
    </span>
  );
}

function FulfillmentDialog({
  row,
  onOpenChange,
}: {
  row: LogisticsRowView | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(updateFulfillmentAction, INITIAL);
  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);
  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="size-4 text-primary" />
            Update fulfillment
          </DialogTitle>
          <DialogDescription>
            {row ? `Order ${row.orderNo}${row.customerName ? ` · ${row.customerName}` : ""}` : ""}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <input type="hidden" name="orderId" value={row?.id ?? ""} />
          <div className="grid gap-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              name="status"
              defaultValue={row?.fulfillmentStatus ?? "pending"}
              className={SELECT_CLASS}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="courier">Courier</Label>
              <Input id="courier" name="courier" defaultValue={row?.courier ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cost">Shipping cost</Label>
              <Input
                id="cost"
                name="cost"
                inputMode="decimal"
                defaultValue={row?.shippingCost ?? "0"}
              />
              {fe.cost && <p className="text-xs text-destructive">{fe.cost}</p>}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="trackingNo">Tracking no.</Label>
            <Input id="trackingNo" name="trackingNo" defaultValue={row?.trackingNo ?? ""} />
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
