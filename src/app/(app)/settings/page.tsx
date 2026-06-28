import { Separator } from "@/components/ui/separator";
import { getActiveCompany, requireAuth, WRITE_ROLES } from "@/lib/auth/rbac";
import { listCashAccounts, listCategories } from "@/lib/catalog";
import { CashAccountsManager } from "./cash-accounts-manager";
import { CategoriesManager } from "./categories-manager";

export default async function SettingsPage() {
  await requireAuth();
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

  const [categories, accounts] = await Promise.all([
    listCategories(active.id),
    listCashAccounts(active.id),
  ]);

  const canWrite = WRITE_ROLES.includes(active.role);
  const canDelete = active.role === "owner" || active.role === "admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          {active.name} · reference data for expenses. User &amp; role management
          arrives in Phase 5.
        </p>
      </div>

      <CashAccountsManager
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          openingBalance: a.openingBalance,
          currency: a.currency,
        }))}
        canWrite={canWrite}
        canDelete={canDelete}
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
        canDelete={canDelete}
      />
    </div>
  );
}
