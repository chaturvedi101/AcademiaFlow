
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
  Loader2,
  Settings2,
  UserCircle,
  Database,
  Settings,
  Share2
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, useUser, useDoc, useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { UserProfile, UserRole } from "@/lib/types";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['bos_convenor', 'bos_member', 'dean_faculty', 'dean_academic', 'admin', 'monitor', 'committee_convenor'] },
  { name: 'Programs', href: '/dashboard/programs', icon: GraduationCap, roles: ['dean_academic', 'admin'] },
  { name: 'BoS Authorization', href: '/dashboard/users', icon: ShieldCheck, roles: ['dean_academic', 'admin', 'monitor'] },
  { name: 'My BoS Team', href: '/dashboard/team', icon: UserCircle, roles: ['bos_convenor'] },
  { name: 'Schemes', href: '/dashboard/schemes', icon: BookOpen, roles: ['bos_convenor', 'bos_member', 'dean_faculty', 'dean_academic', 'admin', 'monitor', 'committee_convenor'] },
  { name: 'Pool Distributor', href: '/dashboard/distributor', icon: Share2, roles: ['admin', 'dean_academic'] },
  { name: 'Equivalence Manager', href: '/dashboard/equivalence', icon: Layers, roles: ['bos_convenor', 'admin'] },
  { name: 'Approvals', href: '/dashboard/approvals', icon: FileCheck, roles: ['dean_faculty', 'dean_academic', 'admin', 'monitor'] },
  { name: 'Audit Logs', href: '/dashboard/audit', icon: History, roles: ['admin'] },
  { name: 'Backups', href: '/dashboard/backups', icon: Database, roles: ['admin'] },
  { name: 'AI Diagnostics', href: '/dashboard/diagnostics', icon: Settings2, roles: ['admin', 'dean_academic'] },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings, roles: ['bos_convenor', 'dean_faculty', 'dean_academic', 'admin', 'monitor', 'committee_convenor'] },
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
  const isCommonBos = profile?.faculty?.includes('(Common BOS)');

  const rtuLogo = PlaceHolderImages.find(img => img.id === 'rtu-logo');

  const filteredNav = navigation.filter(item => {
    if (isCommonBos && item.name === 'My BoS Team') return false;
    return item.roles.includes(role);
  });

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/');
  };

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50 flex flex-row items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 bg-white rounded-lg p-1 shrink-0 shadow-sm border border-primary/10 overflow-hidden">
          {rtuLogo && (
            <Image 
              src={rtuLogo.imageUrl} 
              alt="RTU Logo" 
              width={32} 
              height={32} 
              className="object-contain"
              priority
              unoptimized
              data-ai-hint="RTU Logo"
            />
          )}
        </div>
        <div className="flex flex-col group-data-[collapsible=icon]:hidden">
          <span className="font-headline font-bold text-lg text-white leading-tight">
            Academia Flow
          </span>
          <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">RTU Kota</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {profileLoading ? (
          <div className="p-4 flex justify-center">
            <Loader2 className="animate-spin text-white/20" />
          </div>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel>Institutional Menu</SidebarGroupLabel>
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
