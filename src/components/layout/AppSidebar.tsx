
'use client';

import { useMemo } from 'react';
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
  ShieldCheck,
  Layers,
  LogOut,
  GraduationCap,
  Users,
  Loader2
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useUser, useDoc, useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { UserProfile, UserRole } from "@/lib/types";

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['bos_convenor', 'dean_faculty', 'dean_academics', 'admin'] },
  { name: 'Programs', href: '/dashboard/programs', icon: GraduationCap, roles: ['dean_academics', 'admin'] },
  { name: 'User Access', href: '/dashboard/users', icon: Users, roles: ['dean_academics', 'admin'] },
  { name: 'Schemes', href: '/dashboard/schemes', icon: BookOpen, roles: ['bos_convenor', 'dean_faculty', 'dean_academics', 'admin'] },
  { name: 'Equivalence Manager', href: '/dashboard/equivalence', icon: Layers, roles: ['bos_convenor', 'admin'] },
  { name: 'Approvals', href: '/dashboard/approvals', icon: FileCheck, roles: ['dean_faculty', 'dean_academics'] },
  { name: 'Audit Logs', href: '/dashboard/audit', icon: History, roles: ['admin'] },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: userLoading } = useUser();
  const auth = useAuth();
  const db = useFirestore();

  const userDocRef = useMemo(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const role: UserRole = profile?.role || 'bos_convenor';

  const filteredNav = navigation.filter(item => item.roles.includes(role));

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

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
        {profileLoading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="animate-spin text-white/20" />
          </div>
        ) : (
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
        )}
      </SidebarContent>
      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              tooltip="Logout" 
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
              onClick={handleLogout}
            >
              <LogOut />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
