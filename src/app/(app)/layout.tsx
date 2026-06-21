import { Suspense } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ShellSkeleton } from "@/components/shell-skeleton";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  getActiveCompanyId,
  getMyCompanies,
  requireAuth,
  resolveActiveCompany,
} from "@/lib/auth/rbac";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The shell reads cookies/auth (dynamic); a Suspense boundary lets Next render
  // a static shell immediately and stream the authed UI (Cache Components).
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AuthedLayout>{children}</AuthedLayout>
    </Suspense>
  );
}

async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth(); // defense in depth (proxy also gates)
  const [companies, cookieId] = await Promise.all([
    getMyCompanies(),
    getActiveCompanyId(),
  ]);
  const active = resolveActiveCompany(companies, cookieId);

  return (
    <SidebarProvider>
      <AppSidebar
        companies={companies}
        activeCompanyId={active?.id ?? null}
        userEmail={user.email ?? ""}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <span className="text-sm font-medium">Dashboard</span>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
