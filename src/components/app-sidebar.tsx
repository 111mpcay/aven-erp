"use client";

import {
  BarChart3,
  LayoutDashboard,
  Receipt,
  Settings,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

import { CompanySwitcher, type Company } from "@/components/company-switcher";
import { UserMenu } from "@/components/user-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { title: "Orders", href: "#", icon: ShoppingCart, enabled: false },
  { title: "Expenses", href: "#", icon: Receipt, enabled: false },
  { title: "Reports", href: "#", icon: BarChart3, enabled: false },
  { title: "Settings", href: "#", icon: Settings, enabled: false },
] as const;

export function AppSidebar({
  companies,
  activeCompanyId,
  userEmail,
}: {
  companies: Company[];
  activeCompanyId: string | null;
  userEmail: string;
}) {
  return (
    <Sidebar>
      <SidebarHeader>
        <CompanySwitcher companies={companies} activeCompanyId={activeCompanyId} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {NAV.map((item) => (
              <SidebarMenuItem key={item.title}>
                {item.enabled ? (
                  <SidebarMenuButton render={<Link href={item.href} />}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                ) : (
                  <SidebarMenuButton disabled aria-disabled>
                    <item.icon />
                    <span>{item.title}</span>
                    <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      soon
                    </span>
                  </SidebarMenuButton>
                )}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu email={userEmail} />
      </SidebarFooter>
    </Sidebar>
  );
}
