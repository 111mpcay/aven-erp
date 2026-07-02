import { ScrollText } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { hasPinConfigured } from "@/lib/auth/pin";
import { getActiveCompany, requireAuth, WRITE_ROLES } from "@/lib/auth/rbac";
import { listCashAccounts, listCategories } from "@/lib/catalog";
import { listMembers } from "@/lib/members";
import { CashAccountsManager } from "./cash-accounts-manager";
import { CategoriesManager } from "./categories-manager";
import { SecuritySection } from "./security-section";
import { TeamManager } from "./team-manager";

export default async function SettingsPage() {
  const user = await requireAuth();
  const { active } = await getActiveCompany();

  if (!active) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          You don&apos;t belong to any company yet. Ask an admin to add you.
        </p>
      </div>
    );
  }

  const isAdmin = active.role === "owner" || active.role === "admin";
  const [categories, accounts, hasPin, members] = await Promise.all([
    listCategories(active.id),
    listCashAccounts(active.id),
    hasPinConfigured(user.id),
    isAdmin ? listMembers(active.id) : Promise.resolve([]),
  ]);

  const canWrite = WRITE_ROLES.includes(active.role);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            {active.name} · reference data, team &amp; security
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/settings/audit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ScrollText />
            Audit log
          </Link>
        )}
      </div>

      <SecuritySection hasPin={hasPin} />

      {isAdmin && (
        <>
          <Separator />
          <TeamManager
            members={members.map((m) => ({
              userId: m.userId,
              role: m.role,
              fullName: m.fullName,
              email: m.email,
            }))}
            currentUserId={user.id}
            canGrantOwner={active.role === "owner"}
          />
        </>
      )}

      <Separator />

      <CashAccountsManager
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          openingBalance: a.openingBalance,
          currency: a.currency,
        }))}
        canWrite={canWrite}
        canDelete={isAdmin}
      />

      <Separator />

      <CategoriesManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          code: c.code,
        }))}
        canWrite={canWrite}
        canDelete={isAdmin}
      />
    </div>
  );
}
