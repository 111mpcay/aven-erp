"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { verifyPinAction, type PinActionResult } from "@/app/(app)/security-actions";
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

const INITIAL: PinActionResult = { ok: false };

/**
 * Reusable PIN prompt for gated actions. When a Server Action returns
 * pinRequired, render this; on success the 5-minute token cookie is set and
 * onVerified() re-submits the original form.
 */
export function PinPrompt({
  open,
  onOpenChange,
  onVerified,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}) {
  const [state, formAction, pending] = useActionState(verifyPinAction, INITIAL);
  // Fire onVerified EXACTLY ONCE per successful verification. Without this guard
  // the effect re-runs whenever the parent passes new inline callbacks (every
  // render), re-submitting the gated action in a loop.
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (state.ok && handled.current !== state) {
      handled.current = state;
      onOpenChange(false);
      onVerified();
    }
  }, [state, onOpenChange, onVerified]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            Enter action PIN
          </DialogTitle>
          <DialogDescription>
            This action is sensitive and needs your PIN (valid ~5 minutes).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="action-pin">PIN</Label>
            <Input
              id="action-pin"
              name="pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              pattern="\d{4,8}"
              minLength={4}
              maxLength={8}
              required
              autoFocus
            />
          </div>
          {state.error && (
            <p className="text-sm text-destructive" role="alert">
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
            <Button type="submit" disabled={pending}>
              {pending ? "Checking…" : "Verify"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
