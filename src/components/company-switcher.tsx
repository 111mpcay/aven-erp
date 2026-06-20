"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";
import { useTransition } from "react";

import { setActiveCompany } from "@/app/(app)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type Company = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

export function CompanySwitcher({
  companies,
  activeCompanyId,
}: {
  companies: Company[];
  activeCompanyId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const active =
    companies.find((c) => c.id === activeCompanyId) ?? companies[0] ?? null;

  if (companies.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled aria-disabled className="opacity-80">
            <Building2 />
            <div className="flex flex-col text-left leading-tight">
              <span className="text-sm font-medium">No companies yet</span>
              <span className="text-xs text-muted-foreground">
                Added in a later phase
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" disabled={isPending}>
                <Building2 />
                <div className="flex flex-col overflow-hidden text-left leading-tight">
                  <span className="truncate text-sm font-medium">
                    {active?.name ?? "Select company"}
                  </span>
                  <span className="truncate text-xs capitalize text-muted-foreground">
                    {active?.role}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="start" className="min-w-56">
            <DropdownMenuLabel>Companies</DropdownMenuLabel>
            {companies.map((c) => (
              <DropdownMenuItem
                key={c.id}
                onClick={() =>
                  startTransition(() => setActiveCompany(c.id))
                }
              >
                <span className="truncate">{c.name}</span>
                {c.id === active?.id && <Check className="ml-auto size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
