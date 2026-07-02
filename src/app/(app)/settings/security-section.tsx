"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { setPinAction, type PinActionResult } from "@/app/(app)/security-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const INITIAL: PinActionResult = { ok: false };

/** Set / change the action PIN (4–8 digits, hashed server-side, never stored raw). */
export function SecuritySection({ hasPin }: { hasPin: boolean }) {
  const [state, formAction, pending] = useActionState(setPinAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-base font-medium">
          <ShieldCheck className="size-4 text-primary" />
          Action PIN
        </h2>
        <p className="text-sm text-muted-foreground">
          Required for sensitive actions: deletes, editing posted records, expenses
          over ₱10,000, and role changes. Separate from your login password.
        </p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3"
      >
        {hasPin && (
          <div className="grid gap-1">
            <Label htmlFor="currentPin" className="text-xs">Current PIN</Label>
            <Input
              id="currentPin"
              name="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={8}
              className="w-32"
              required
            />
          </div>
        )}
        <div className="grid gap-1">
          <Label htmlFor="pin" className="text-xs">{hasPin ? "New PIN" : "PIN (4–8 digits)"}</Label>
          <Input
            id="pin"
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            className="w-32"
            required
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="confirm" className="text-xs">Confirm</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={8}
            className="w-32"
            required
          />
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : hasPin ? "Change PIN" : "Set PIN"}
        </Button>

        {state.error && (
          <p className="w-full text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="w-full text-xs text-primary" role="status">
            PIN saved.
          </p>
        )}
      </form>
    </div>
  );
}
