"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar";
import {
  BookOpen,
  LayoutDashboard,
  FileCheck,
  History,
  Settings,
  ShieldCheck,
  Layers,
  LogOut,
  GraduationCap
} from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { MOCK_USER } from "@/lib/mock-data";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['bos_convenor', 'dean_faculty', 'dean_academics', 'admin'] },
  { name: 'Programs', href: '/dashboard/programs', icon: GraduationCap, roles: ['admin'] },
  { name: 'Schemes', href: '/dashboard/schemes', icon: BookOpen, roles: ['bos_convenor', 'dean_faculty', 'dean_academics', 'admin'] },
  { name: 'Equivalence Manager', href: '/dashboard/equivalence', icon: Layers, roles: ['bos_convenor', 'admin'] },
  { name: 'Approvals', href: '/dashboard/approvals', icon: FileCheck, roles: ['dean_faculty', 'dean_academics'] },
  { name: 'Audit Logs', href: '/dashboard/audit', icon: History, roles: ['admin'] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const user = MOCK_USER; // In real app, get from AuthContext

  const filteredNav = navigation.filter(item => item.roles.includes(user.role));

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4 flex flex-row items-center gap-2">
        <div className="bg-accent p-1.5 rounded-lg">
          <ShieldCheck className="text-white w-6 h-6" />
        </div>
        <span className="font-headline font-bold text-xl text-white tracking-tight group-data-[collapsible=icon]:hidden">
          Academia Flow
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNav.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.name}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Logout" className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
