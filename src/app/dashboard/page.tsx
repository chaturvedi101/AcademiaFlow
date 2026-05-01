'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useUser, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, AlertCircle, ArrowRight, Layers, ShieldCheck, GraduationCap, Loader2, FileCheck, Plus } from "lucide-react";
import Link from "next/link";
import { Scheme, Program, UserProfile } from '@/lib/types';

export default function DashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemo(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const { data: schemes, loading: schemesLoading } = useCollection<Scheme>(collection(db, 'schemes'));
  const { data: programs, loading: programsLoading } = useCollection<Program>(collection(db, 'programs'));

  const filteredSchemes = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_faculty' || profile.role === 'dean_academics') {
      return schemes;
    }
    // Filter for BoS Convenor: only schemes in their managed branches
    const managed = profile.managedBranches || [];
    return schemes.filter(s => 
      managed.some(m => m.programId === s.programId && m.branch === s.branch)
    );
  }, [schemes, profile]);

  const stats = useMemo(() => {
    return {
      activeSchemes: filteredSchemes.length,
      pendingApproval: filteredSchemes.filter(s => s.status.includes('Pending')).length,
      approved: filteredSchemes.filter(s => s.status === 'Approved').length,
      programs: programs.length,
    };
  }, [filteredSchemes, programs]);

  if (profileLoading || schemesLoading || programsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Academic Overview</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.displayName || 'User'}. 
          Role: <span className="font-bold text-primary">{profile?.role?.replace('_', ' ').toUpperCase()}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard 
          title="Your Schemes" 
          value={stats.activeSchemes} 
          trend={profile?.role === 'bos_convenor' ? "In your assigned branches" : "Across all programs"} 
          icon={<FileText className="text-primary" />} 
        />
        <StatsCard 
          title="Pending Approval" 
          value={stats.pendingApproval} 
          trend="Awaiting review" 
          icon={<Clock className="text-accent" />} 
          variant="warning"
        />
        <StatsCard 
          title="Approved Layouts" 
          value={stats.approved} 
          trend="Finalized schemes" 
          icon={<CheckCircle2 className="text-green-500" />} 
        />
        <StatsCard 
          title="Program Catalog" 
          value={stats.programs} 
          trend="Defined disciplines" 
          icon={<GraduationCap className="text-muted-foreground" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Recent Activity</CardTitle>
              <CardDescription>Monitor the latest changes in your academic jurisdiction.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/schemes">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSchemes.slice(0, 5).map(scheme => {
                const program = programs.find(p => p.id === scheme.programId);
                return (
                  <SchemeRow 
                    key={scheme.id}
                    id={scheme.id}
                    name={program?.name || 'Unknown Program'} 
                    batch={scheme.batchYear} 
                    status={scheme.status} 
                    updated="Recently" 
                  />
                );
              })}
              {filteredSchemes.length === 0 && (
                <div className="text-center py-10 text-muted-foreground italic">
                  No academic schemes registered in your assigned branches yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-headline">Role-Specific Actions</CardTitle>
            <CardDescription>Tasks based on your academic role.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(profile?.role === 'bos_convenor' || profile?.role === 'admin') && (
              <>
                <ActionLink href="/dashboard/schemes" label="Draft New Scheme" icon={<Plus className="w-4 h-4" />} />
                <ActionLink href="/dashboard/equivalence" label="Map Subject Equivalence" icon={<Layers className="w-4 h-4" />} />
              </>
            )}
            {(profile?.role === 'dean_faculty' || profile?.role === 'dean_academics' || profile?.role === 'admin') && (
              <ActionLink href="/dashboard/approvals" label="Review Pending Schemes" icon={<FileCheck className="w-4 h-4" />} />
            )}
            {(profile?.role === 'dean_academics' || profile?.role === 'admin') && (
              <ActionLink href="/dashboard/programs" label="Configure Programs" icon={<GraduationCap className="w-4 h-4" />} />
            )}
            {profile?.role === 'admin' && (
              <ActionLink href="/dashboard/audit" label="System Audit Logs" icon={<ShieldCheck className="w-4 h-4" />} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatsCard({ title, value, trend, icon, variant = 'default' }: any) {
  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden relative group">
      <div className={`absolute top-0 left-0 w-1 h-full ${variant === 'warning' ? 'bg-accent' : 'bg-primary'}`}></div>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="p-2 rounded-lg bg-muted group-hover:bg-muted/80 transition-colors">
            {icon}
          </div>
          <span className="text-xs font-medium text-muted-foreground">{trend}</span>
        </div>
        <div className="space-y-1">
          <p className="text-2xl font-bold font-headline">{value}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SchemeRow({ id, name, batch, status, updated }: any) {
  const statusColors: any = {
    'Draft': 'bg-slate-100 text-slate-700',
    'Pending Dean': 'bg-amber-100 text-amber-700',
    'Pending Academics': 'bg-blue-100 text-blue-700',
    'Approved': 'bg-emerald-100 text-emerald-700'
  };

  return (
    <Link href={`/dashboard/schemes/${id}`} className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors">
      <div className="space-y-1">
        <p className="font-medium text-sm">{name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Batch: {batch}</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>Updated {updated}</span>
        </div>
      </div>
      <Badge variant="outline" className={`${statusColors[status] || 'bg-slate-100 text-slate-700'} border-none font-medium text-[10px]`}>
        {status}
      </Badge>
    </Link>
  );
}

function ActionLink({ href, label, icon }: { href: string, label: string, icon: any }) {
  return (
    <Link 
      href={href} 
      className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-primary hover:text-white group transition-all"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}
