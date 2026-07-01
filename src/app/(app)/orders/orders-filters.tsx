"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANNEL_LABELS, type SalesChannel } from "./types";

const SELECT_CLASS =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function OrdersFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const apply = useCallback(
    (formData: FormData) => {
      const next = new URLSearchParams();
      for (const key of ["q", "dateFrom", "dateTo", "paymentStatus", "channel"]) {
        const v = String(formData.get(key) ?? "").trim();
        if (v) next.set(key, v);
      }
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
          placeholder="Order no. or customer"
          defaultValue={params.get("q") ?? ""}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dateFrom">From</Label>
        <Input id="dateFrom" name="dateFrom" type="date" defaultValue={params.get("dateFrom") ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dateTo">To</Label>
        <Input id="dateTo" name="dateTo" type="date" defaultValue={params.get("dateTo") ?? ""} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="paymentStatus">Payment</Label>
        <select
          id="paymentStatus"
          name="paymentStatus"
          defaultValue={params.get("paymentStatus") ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">All</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="channel">Channel</Label>
        <select
          id="channel"
          name="channel"
          defaultValue={params.get("channel") ?? ""}
          className={SELECT_CLASS}
        >
          <option value="">All</option>
          {(Object.keys(CHANNEL_LABELS) as SalesChannel[]).map((c) => (
            <option key={c} value={c}>
              {CHANNEL_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <Button type="submit">Apply filters</Button>
        {Array.from(params.keys()).length > 0 && (
          <Button type="button" variant="ghost" onClick={() => router.push(pathname)}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
