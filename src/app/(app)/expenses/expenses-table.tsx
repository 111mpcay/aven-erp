"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, FileText, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

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
import type { ExpenseRowView } from "./types";

export function ExpensesTable({
  rows,
  canWrite,
  canDelete,
  onEdit,
  onDelete,
}: {
  rows: ExpenseRowView[];
  canWrite: boolean;
  canDelete: boolean;
  onEdit: (row: ExpenseRowView) => void;
  onDelete: (row: ExpenseRowView) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "expenseDate", desc: true },
  ]);

  const columns = useMemo<ColumnDef<ExpenseRowView>[]>(() => {
    const cols: ColumnDef<ExpenseRowView>[] = [
      {
        accessorKey: "expenseDate",
        header: ({ column }) => (
          <SortHeader
            label="Date"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => formatDate(row.original.expenseDate),
      },
      {
        accessorKey: "categoryName",
        header: "Category",
        cell: ({ row }) => row.original.categoryName ?? "—",
      },
      {
        accessorKey: "cashAccountName",
        header: "Account",
        cell: ({ row }) => row.original.cashAccountName ?? "—",
      },
      {
        accessorKey: "vendor",
        header: "Vendor",
        cell: ({ row }) => row.original.vendor || "—",
      },
      {
        accessorKey: "amount",
        header: ({ column }) => (
          <SortHeader
            label="Amount"
            className="justify-end"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        sortingFn: (a, b) => Number(a.original.amount) - Number(b.original.amount),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {formatMoney(row.original.amount, row.original.currency)}
          </div>
        ),
      },
      {
        id: "receipt",
        header: "Receipt",
        cell: ({ row }) =>
          row.original.receiptPath ? (
            <a
              href={`/expenses/receipt?path=${encodeURIComponent(row.original.receiptPath)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <FileText className="size-3.5" />
              View
            </a>
          ) : (
            <span className="text-muted-foreground">—</span>
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
                aria-label="Edit expense"
                onClick={() => onEdit(row.original)}
              >
                <Pencil />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete expense"
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
                  {h.isPlaceholder
                    ? null
                    : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                No expenses match the current filters.
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
