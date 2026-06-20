"use client";

import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { useTransition } from "react";

import { signOut } from "@/app/(app)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function UserMenu({ email }: { email: string }) {
  const [isPending, startTransition] = useTransition();
  const initial = (email.trim()[0] ?? "U").toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg">
                <Avatar className="size-7 rounded-md">
                  <AvatarFallback className="rounded-md bg-sidebar-primary text-xs text-sidebar-primary-foreground">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-sm">{email || "Account"}</span>
                <ChevronsUpDown className="ml-auto size-4 shrink-0" />
              </SidebarMenuButton>
            }
          />
          <DropdownMenuContent align="end" className="min-w-56">
            <DropdownMenuLabel className="truncate">
              {email || "Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <UserRound />
              Profile (soon)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              disabled={isPending}
              onClick={() => startTransition(() => signOut())}
            >
              <LogOut />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
