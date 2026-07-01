"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { CHANNEL_LABELS, type OrderRowView, type PaymentStatus, type SalesChannel } from "./types";

const PAY_VARIANT: Record<PaymentStatus, "default" | "secondary" | "outline"> = {
  paid: "default",
  partial: "secondary",
  unpaid: "outline",
};
const num = (s: string) => {
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

export function OrdersTable({
  rows,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: OrderRowView[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (row: OrderRowView) => void;
  onDelete: (row: OrderRowView) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "orderDate", desc: true },
  ]);

  const columns = useMemo<ColumnDef<OrderRowView>[]>(() => {
    const cols: ColumnDef<OrderRowView>[] = [
      {
        accessorKey: "orderNo",
        header: ({ column }) => (
          <SortHeader label="Order" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
        ),
        cell: ({ row }) => <span className="font-medium">{row.original.orderNo}</span>,
      },
      {
        accessorKey: "orderDate",
        header: ({ column }) => (
          <SortHeader label="Date" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} />
        ),
        cell: ({ row }) => formatDate(row.original.orderDate),
      },
      {
        accessorKey: "customerName",
        header: "Customer",
        cell: ({ row }) => row.original.customerName || "—",
      },
      {
        accessorKey: "channel",
        header: "Channel",
        cell: ({ row }) =>
          CHANNEL_LABELS[row.original.channel as SalesChannel] ?? row.original.channel,
      },
      {
        accessorKey: "total",
        header: ({ column }) => (
          <SortHeader
            label="Total"
            className="justify-end"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        sortingFn: (a, b) => num(a.original.total) - num(b.original.total),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {formatMoney(row.original.total, row.original.currency)}
          </div>
        ),
      },
      {
        id: "balance",
        header: () => <div className="text-right">Balance</div>,
        cell: ({ row }) => {
          const bal = num(row.original.total) - num(row.original.amountPaid);
          return (
            <div className="text-right tabular-nums">
              {formatMoney(bal, row.original.currency)}
            </div>
          );
        },
      },
      {
        accessorKey: "paymentStatus",
        header: "Payment",
        cell: ({ row }) => (
          <Badge variant={PAY_VARIANT[row.original.paymentStatus]} className="capitalize">
            {row.original.paymentStatus}
          </Badge>
        ),
      },
    ];

    if (canWrite || canDelete) {
      cols.push({
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            {canWrite && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit order"
                onClick={() => onEdit(row.original)}
              >
                <Pencil />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete order"
                onClick={() => onDelete(row.original)}
              >
                <Trash2 className="text-destructive" />
              </Button>
            )}
          </div>
        ),
      });
    }
    return cols;
  }, [canWrite, canDelete, onEdit, onDelete]);

  // React Compiler can't memoize TanStack Table's returned functions; safe here —
  // this table is a leaf and none of its functions are passed to memoized children.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="rounded-xl border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No orders match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SortHeader({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 hover:text-foreground ${className ?? ""}`}
    >
      {label}
      <ArrowUpDown className="size-3.5 text-muted-foreground" />
    </button>
  );
}
