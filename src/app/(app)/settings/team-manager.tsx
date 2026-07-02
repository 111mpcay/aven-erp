"use client";

import { UserPlus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";

import { PinPrompt } from "@/components/pin-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
  type ActionResult,
} from "./team-actions";

const SELECT_CLASS =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";
const INITIAL: ActionResult = { ok: false };
const ROLE_OPTIONS = ["owner", "admin", "accountant", "encoder", "viewer"] as const;

export type TeamMember = {
  userId: string;
  role: string;
  fullName: string | null;
  email: string | null;
};

/**
 * Team management (owner/admin only; role changes are PIN-gated server-side).
 * Mobile-first: each member is a wrapping flex row — identity stacks above the
 * controls on narrow screens instead of overflowing a table.
 */
export function TeamManager({
  members,
  currentUserId,
  canGrantOwner,
}: {
  members: TeamMember[];
  currentUserId: string;
  canGrantOwner: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-medium">Team</h2>
        <p className="text-sm text-muted-foreground">
          Who can access this company. Role changes require your PIN.
        </p>
      </div>

      <div className="divide-y rounded-xl border">
        {members.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            isSelf={m.userId === currentUserId}
            canGrantOwner={canGrantOwner}
          />
        ))}
      </div>

      <AddMemberForm canGrantOwner={canGrantOwner} />
    </div>
  );
}

function MemberRow({
  member,
  isSelf,
  canGrantOwner,
}: {
  member: TeamMember;
  isSelf: boolean;
  canGrantOwner: boolean;
}) {
  const [roleState, roleAction, rolePending] = useActionState(
    updateMemberRoleAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeMemberAction,
    INITIAL,
  );
  const roleFormRef = useRef<HTMLFormElement>(null);
  const removeFormRef = useRef<HTMLFormElement>(null);
  // Derived: which action (if any) is currently blocked on a PIN.
  const [pinDismissed, setPinDismissed] = useState<unknown>(null);
  const pinSource =
    roleState.pinRequired && pinDismissed !== roleState
      ? ("role" as const)
      : removeState.pinRequired && pinDismissed !== removeState
        ? ("remove" as const)
        : null;

  const error =
    (!roleState.pinRequired && roleState.error) ||
    (!removeState.pinRequired && removeState.error) ||
    null;

  return (
    <div className="flex flex-wrap items-center gap-2 p-3">
      <div className="min-w-0 flex-1 basis-52">
        <p className="truncate text-sm font-medium">
          {member.fullName || member.email || member.userId.slice(0, 8)}
          {isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
        </p>
        {member.email && (
          <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        )}
      </div>

      <form ref={roleFormRef} action={roleAction} className="flex items-center gap-2">
        <input type="hidden" name="userId" value={member.userId} />
        <select
          name="role"
          defaultValue={member.role}
          className={SELECT_CLASS}
          disabled={rolePending || isSelf}
          aria-label={`Role for ${member.email ?? member.userId}`}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} disabled={r === "owner" && !canGrantOwner}>
              {r}
            </option>
          ))}
        </select>
      </form>

      <form ref={removeFormRef} action={removeAction}>
        <input type="hidden" name="userId" value={member.userId} />
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          className="text-destructive"
          disabled={removePending || isSelf}
        >
          Remove
        </Button>
      </form>

      {error && (
        <p className="w-full text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      <PinPrompt
        open={pinSource !== null}
        onOpenChange={(open) => {
          if (!open) setPinDismissed(pinSource === "role" ? roleState : removeState);
        }}
        onVerified={() => {
          // Submit ONLY the form that triggered the prompt — never fall through
          // to the remove form (which would silently delete the member).
          if (pinSource === "role") roleFormRef.current?.requestSubmit();
          else if (pinSource === "remove") removeFormRef.current?.requestSubmit();
        }}
      />
    </div>
  );
}

function AddMemberForm({ canGrantOwner }: { canGrantOwner: boolean }) {
  const [state, formAction, pending] = useActionState(addMemberAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);
  // Derived: prompt is open while the latest result demands a PIN, undismissed.
  const [pinDismissed, setPinDismissed] = useState<ActionResult | null>(null);
  const pinOpen = Boolean(state.pinRequired) && pinDismissed !== state;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-wrap items-end gap-2 rounded-xl border bg-card p-3"
    >
      <div className="grid min-w-0 flex-1 basis-52 gap-1">
        <Label htmlFor="member-email" className="text-xs">
          Add member by email (must have an account)
        </Label>
        <Input
          id="member-email"
          name="email"
          type="email"
          placeholder="teammate@company.com"
          required
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="member-role" className="text-xs">
          Role
        </Label>
        <select id="member-role" name="role" defaultValue="encoder" className={SELECT_CLASS}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r} disabled={r === "owner" && !canGrantOwner}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        <UserPlus />
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error && !state.pinRequired && (
        <p className="w-full text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <PinPrompt
        open={pinOpen}
        onOpenChange={(open) => {
          if (!open) setPinDismissed(state);
        }}
        onVerified={() => formRef.current?.requestSubmit()}
      />
    </form>
  );
}
