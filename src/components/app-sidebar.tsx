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
  { title: "Orders", href: "/orders", icon: ShoppingCart, enabled: true },
  { title: "Expenses", href: "/expenses", icon: Receipt, enabled: true },
  { title: "Reports", href: "/reports", icon: BarChart3, enabled: true },
  { title: "Settings", href: "/settings", icon: Settings, enabled: true },
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
    // print:hidden — the fixed icon rail would repeat on every printed page.
    <Sidebar collapsible="icon" className="print:hidden">
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
