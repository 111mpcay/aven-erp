"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useEffect, useMemo, useState } from "react";

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
import { formatMoney } from "@/lib/format";
import {
  createOrderAction,
  updateOrderAction,
  type ActionResult,
} from "./actions";
import {
  CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  type AccountOption,
  type EditableItem,
  type EditableOrder,
  type SalesChannel,
} from "./types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const INITIAL: ActionResult = { ok: false };
const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
const emptyItem = (): EditableItem => ({
  productName: "",
  sku: "",
  qty: "1",
  unitPrice: "0",
  unitCost: "0",
});

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

export function OrderFormDialog({
  open,
  onOpenChange,
  accounts,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountOption[];
  editing: EditableOrder | null;
}) {
  const isEdit = editing !== null;
  const action = isEdit ? updateOrderAction : createOrderAction;
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const [items, setItems] = useState<EditableItem[]>(
    editing?.items.length ? editing.items : [emptyItem()],
  );
  const [shippingFee, setShippingFee] = useState(editing?.shippingFee ?? "0");
  const [discount, setDiscount] = useState(editing?.discount ?? "0");
  const [amountPaid, setAmountPaid] = useState(editing?.amountPaid ?? "0");
  const [currency, setCurrency] = useState(editing?.currency ?? "PHP");

  useEffect(() => {
    if (state.ok) onOpenChange(false);
  }, [state, onOpenChange]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.unitPrice), 0);
    const cogs = items.reduce((s, it) => s + num(it.qty) * num(it.unitCost), 0);
    const total = subtotal + num(shippingFee) - num(discount);
    const paid = num(amountPaid);
    const balance = total - paid;
    const status = paid <= 0 ? "unpaid" : paid >= total ? "paid" : "partial";
    return { subtotal, cogs, total, balance, status };
  }, [items, shippingFee, discount, amountPaid]);

  const fe = state.fieldErrors ?? {};
  const updateItem = (i: number, field: keyof EditableItem, value: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit order" : "New order"}</DialogTitle>
          <DialogDescription>
            Record a sale with line items. Totals and payment status are computed
            automatically.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
          {isEdit && <input type="hidden" name="id" value={editing.id} />}
          <input type="hidden" name="itemsJson" value={JSON.stringify(items)} />

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="orderNo">Order no.</Label>
              <Input
                id="orderNo"
                name="orderNo"
                placeholder="Auto"
                defaultValue={editing?.orderNo ?? ""}
              />
              {fe.orderNo && <FieldError msg={fe.orderNo} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="orderDate">Date</Label>
              <Input
                id="orderDate"
                name="orderDate"
                type="date"
                required
                defaultValue={editing?.orderDate ?? todayIso()}
              />
              {fe.orderDate && <FieldError msg={fe.orderDate} />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="customerName">Customer</Label>
              <Input
                id="customerName"
                name="customerName"
                defaultValue={editing?.customerName ?? ""}
              />
              {fe.customerName && <FieldError msg={fe.customerName} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="channel">Channel</Label>
              <select
                id="channel"
                name="channel"
                defaultValue={editing?.channel ?? "other"}
                className={SELECT_CLASS}
              >
                {(Object.keys(CHANNEL_LABELS) as SalesChannel[]).map((c) => (
                  <option key={c} value={c}>
                    {CHANNEL_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line items */}
          <div className="grid gap-1.5">
            <Label>Items</Label>
            <div className="rounded-lg border">
              <div className="grid grid-cols-[1fr_70px_70px_80px_80px_28px] gap-2 border-b bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <span>Product</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Cost</span>
                <span className="text-right">Line</span>
                <span />
              </div>
              {items.map((it, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_70px_70px_80px_80px_28px] items-center gap-2 px-2 py-1.5"
                >
                  <Input
                    aria-label="Product"
                    value={it.productName}
                    onChange={(e) => updateItem(i, "productName", e.target.value)}
                    placeholder="Product"
                  />
                  <Input
                    aria-label="Quantity"
                    inputMode="decimal"
                    value={it.qty}
                    onChange={(e) => updateItem(i, "qty", e.target.value)}
                  />
                  <Input
                    aria-label="Unit price"
                    inputMode="decimal"
                    value={it.unitPrice}
                    onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                  />
                  <Input
                    aria-label="Unit cost"
                    inputMode="decimal"
                    value={it.unitCost}
                    onChange={(e) => updateItem(i, "unitCost", e.target.value)}
                  />
                  <span className="text-right text-sm tabular-nums">
                    {formatMoney(num(it.qty) * num(it.unitPrice), currency)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove item"
                    disabled={items.length === 1}
                    onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setItems((p) => [...p, emptyItem()])}
            >
              <Plus />
              Add item
            </Button>
            {fe.items && <FieldError msg={fe.items} />}
          </div>

          {/* Money */}
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="shippingFee">Shipping</Label>
              <Input
                id="shippingFee"
                name="shippingFee"
                inputMode="decimal"
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
              />
              {fe.shippingFee && <FieldError msg={fe.shippingFee} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="discount">Discount</Label>
              <Input
                id="discount"
                name="discount"
                inputMode="decimal"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              {fe.discount && <FieldError msg={fe.discount} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="amountPaid">Amount paid</Label>
              <Input
                id="amountPaid"
                name="amountPaid"
                inputMode="decimal"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
              />
              {fe.amountPaid && <FieldError msg={fe.amountPaid} />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cashAccountId">Payment account</Label>
              <select
                id="cashAccountId"
                name="cashAccountId"
                defaultValue={editing?.cashAccountId ?? ""}
                className={SELECT_CLASS}
              >
                <option value="">— none —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              {fe.cashAccountId && <FieldError msg={fe.cashAccountId} />}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                name="status"
                defaultValue={editing?.status ?? "confirmed"}
                className={SELECT_CLASS}
              >
                {(Object.keys(ORDER_STATUS_LABELS) as (keyof typeof ORDER_STATUS_LABELS)[]).map(
                  (s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <select
                id="currency"
                name="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={SELECT_CLASS}
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
                defaultValue={editing?.fxToPhp ?? "1"}
              />
              {fe.fxToPhp && <FieldError msg={fe.fxToPhp} />}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={editing?.notes ?? ""} />
          </div>

          {/* Totals summary */}
          <div className="grid gap-1 rounded-lg border bg-muted/30 p-3 text-sm tabular-nums">
            <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
            <Row label="COGS" value={formatMoney(totals.cogs, currency)} muted />
            <Row label="Total" value={formatMoney(totals.total, currency)} strong />
            <Row label="Paid" value={formatMoney(num(amountPaid), currency)} />
            <Row label="Balance" value={formatMoney(totals.balance, currency)} />
            <div className="mt-1 flex justify-between">
              <span className="text-muted-foreground">Payment</span>
              <span className="font-medium capitalize">{totals.status}</span>
            </div>
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}
          {!state.error && Object.keys(fe).length > 0 && (
            <p className="text-sm text-destructive" role="alert">
              Please fix the highlighted fields and try again.
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
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : muted ? "text-muted-foreground" : ""}>
        {value}
      </span>
    </div>
  );
}

function FieldError({ msg }: { msg: string }) {
  return (
    <p className="text-xs text-destructive" role="alert">
      {msg}
    </p>
  );
}
