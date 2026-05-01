
'use client';

import { useMemo } from 'react';
import { AppSidebar } from "@/components/layout/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Bell, Search, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUser, useFirestore, useDoc } from "@/firebase";
import { doc } from "firebase/firestore";
import { UserProfile } from "@/lib/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useUser();
  const db = useFirestore();
  
  const userDocRef = useMemo(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading } = useDoc<UserProfile>(userDocRef);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b bg-white px-6">
          <div className="flex items-center gap-4 flex-1">
            <SidebarTrigger />
            <div className="relative w-full max-w-md hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search subject code, program, batch..."
                className="pl-9 bg-muted/50 border-none focus-visible:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-muted rounded-full relative">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-px bg-border"></div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                {loading ? (
                  <div className="flex justify-end">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium leading-none">{profile?.displayName || 'Academic User'}</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mt-1">
                      {profile?.role?.replace('_', ' ') || 'Guest'}
                    </p>
                  </>
                )}
              </div>
              <div className="bg-primary/10 p-2 rounded-full">
                <User className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
