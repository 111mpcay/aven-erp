"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountOption, CategoryOption } from "./types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ExpensesFilters({
  categories,
  accounts,
}: {
  categories: CategoryOption[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = useCallback(
    (formData: FormData) => {
      const next = new URLSearchParams();
      for (const key of ["q", "dateFrom", "dateTo", "categoryId", "cashAccountId"]) {
        const v = String(formData.get(key) ?? "").trim();
        if (v) next.set(key, v);
      }
      // Reset to page 1 whenever filters change.
      router.push(next.toString() ? `${pathname}?${next}` : pathname);
    },
    [pathname, router],
  );

  return (
    <form
      action={apply}
      className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6"
    >
      <div className="grid gap-1.5 lg:col-span-2">
        <Label htmlFor="q">Search</Label>
        <Input
          id="q"
          name="q"
          placeholder="Vendor or description"
          defaultValue={params.get("q") ?? ""}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dateFrom">From</Label>
        <Input
          id="dateFrom"
          name="dateFrom"
          type="date"
          defaultValue={params.get("dateFrom") ?? ""}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dateTo">To</Label>
        <Input
          id="dateTo"
          name="dateTo"
          type="date"
          defaultValue={params.get("dateTo") ?? ""}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="categoryId">Category</Label>
        <select
          id="categoryId"
          name="categoryId"
          defaultValue={params.get("categoryId") ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cashAccountId">Account</Label>
        <select
          id="cashAccountId"
          name="cashAccountId"
          defaultValue={params.get("cashAccountId") ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">All</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit">Apply filters</Button>
        {Array.from(params.keys()).length > 0 && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(pathname)}
          >
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
