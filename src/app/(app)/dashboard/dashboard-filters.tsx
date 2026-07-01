"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { manilaDateDaysAgo } from "@/lib/format";

const PRESETS = [
  { label: "7d", days: 6 },
  { label: "30d", days: 29 },
  { label: "90d", days: 89 },
] as const;

export function DashboardFilters({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const push = useCallback(
    (f: string, t: string) => {
      const next = new URLSearchParams(params);
      next.set("from", f);
      next.set("to", t);
      router.push(`${pathname}?${next}`);
    },
    [params, pathname, router],
  );

  const apply = useCallback(
    (formData: FormData) => {
      const f = String(formData.get("from") ?? "").trim();
      const t = String(formData.get("to") ?? "").trim();
      if (f && t) push(f, t);
    },
    [push],
  );

  return (
    // key remounts the uncontrolled inputs when the canonical range changes
    // (e.g. a preset click), so edited-but-unsubmitted values never go stale.
    <form key={`${from}:${to}`} action={apply} className="flex flex-wrap items-end gap-2">
      <div className="grid gap-1">
        <Label htmlFor="from" className="text-xs">From</Label>
        <Input id="from" name="from" type="date" defaultValue={from} className="w-36" />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="to" className="text-xs">To</Label>
        <Input id="to" name="to" type="date" defaultValue={to} className="w-36" />
      </div>
      <Button type="submit" size="sm">Apply</Button>
      <div className="ml-1 flex gap-1">
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => push(manilaDateDaysAgo(p.days), manilaDateDaysAgo(0))}
          >
            {p.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
