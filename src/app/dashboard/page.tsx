'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle2, ArrowRight, Layers, ShieldCheck, GraduationCap, Loader2, FileCheck, Plus, UserCircle, Hash, BookOpen } from "lucide-react";
import Link from "next/link";
import { Scheme, Program, UserProfile } from '@/lib/types';

export default function DashboardPage() {
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const { data: schemes, loading: schemesLoading } = useCollection<Scheme>(useMemoFirebase(() => collection(db, 'schemes'), [db]));
  const { data: programs, loading: programsLoading } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));

  const filteredSchemes = useMemo(() => {
    if (!profile || !programs.length) return [];
    
    // 1. Global Administrative Oversight (Admins, Dean Academic, and Monitors)
    if (profile.role === 'admin' || profile.role === 'dean_academic' || profile.role === 'monitor') {
      return schemes;
    }

    // 2. Committee Convenors purview
    if (profile.role === 'committee_convenor') {
      return schemes.filter(s => s.isCommitteePool && s.branch === profile.faculty);
    }

    const isCommonTier = profile.faculty?.includes('(Common BOS)');
    const isBTECHTier = profile.faculty?.includes('BTECH');
    const isBBATier = profile.faculty?.includes('BBA');
    const isScienceDean = profile.role === 'dean_faculty' && profile.faculty === 'Faculty of Sciences';

    // 3. Deans & Common BOS Purview Resolution
    if (profile.role === 'dean_faculty' || isCommonTier) {
      return schemes.filter(s => {
        // Pool Visibility
        if (s.programId === 'INSTITUTIONAL') {
          // Special Oversight: Dean Sciences for Science Committees
          if (isScienceDean) {
             const scienceCommittees = ['Course Committee - Physics', 'Course Committee - Chemistry', 'Course Committee - Mathematics'];
             if (scienceCommittees.includes(s.branch || '')) return true;
          }
          
          if (isBTECHTier && (s.branch?.includes('BTECH') || s.isVerticalPool)) return true;
          if (isBBATier && (s.branch?.includes('BBA') || s.isVerticalPool)) return true;
          return false;
        }

        // Program Visibility: Show schemes in matching program faculties
        const prog = programs.find(p => p.id === s.programId);
        if (!prog) return false;

        // Strict faculty match for Faculty Deans
        if (profile.role === 'dean_faculty' && prog.faculty === profile.faculty) return true;

        // Tiered match for Common BOS (Dean or Member)
        if (isBTECHTier) return prog.faculty.includes('BTECH') || prog.name.includes('BTECH');
        if (isBBATier) return prog.faculty.includes('Management') || prog.name.includes('BBA');
        
        return false;
      });
    }

    // 4. Branch Personnel (Convenors & Members) purview
    const managed = profile.managedBranches || [];
    return schemes.filter(s => {
      // Show matching vertical pools for their tier to allow inheritance lookup
      if (s.isVerticalPool || s.isCommitteePool) {
         return true; // Simplified: Personnel can see pools to inherit from them
      }
      
      // Show assigned branch schemes
      return managed.some(m => m.programId === s.programId && m.branch === s.branch);
    });
  }, [schemes, profile, programs]);

  const stats = useMemo(() => {
    return {
      activeSchemes: filteredSchemes.length,
      pendingApproval: filteredSchemes.filter(s => s.status.includes('Pending')).length,
      approved: filteredSchemes.filter(s => s.status === 'Approved').length,
      programs: (profile?.role === 'dean_faculty') 
        ? programs.filter(p => p.faculty === profile.faculty).length 
        : programs.length,
    };
  }, [filteredSchemes, programs, profile]);

  if (profileLoading || schemesLoading || programsLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Academic Overview</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile?.displayName}. 
          Role: <span className="font-bold text-primary">{profile?.role?.replace('_', ' ').toUpperCase()}</span>
          {profile?.faculty && <span className="ml-2 px-2 py-0.5 bg-accent/10 text-accent rounded text-xs">({profile.faculty})</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Authorized Schemes" value={stats.activeSchemes} trend="In jurisdiction" icon={<FileText className="text-primary" />} />
        <StatsCard title="Pending Review" value={stats.pendingApproval} trend="Awaiting action" icon={<Clock className="text-accent" />} variant="warning" />
        <StatsCard title="Approved" value={stats.approved} trend="Finalized" icon={<CheckCircle2 className="text-green-500" />} />
        <StatsCard title="Programs" value={stats.programs} trend="Total defined" icon={<GraduationCap className="text-muted-foreground" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-headline">Recent Academic Activity</CardTitle>
              <CardDescription>Monitor current status of your assigned faculties or pools.</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild><Link href="/dashboard/schemes">View All</Link></Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredSchemes.slice(0, 5).map(scheme => {
                const program = programs.find(p => p.id === scheme.programId);
                return (
                  <SchemeRow 
                    key={scheme.id} 
                    id={scheme.id} 
                    name={scheme.branch || program?.name || 'Institutional Pool'} 
                    batch={scheme.batchYear} 
                    status={scheme.status} 
                    code={scheme.schemeCode}
                    isVertical={scheme.isVerticalPool}
                    isCommittee={scheme.isCommitteePool}
                  />
                );
              })}
              {filteredSchemes.length === 0 && (
                <div className="text-center py-10 text-muted-foreground italic">
                  No active schemes found in your jurisdiction.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader><CardTitle className="font-headline">Quick Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {(['admin', 'dean_academic', 'committee_convenor'].includes(profile?.role || '')) && <ActionLink href="/dashboard/schemes" label="Manage Pool" icon={<Plus className="w-4 h-4" />} />}
            {profile?.role === 'bos_convenor' && profile?.faculty && !profile.faculty.includes('(Common BOS)') && <ActionLink href="/dashboard/team" label="Manage BoS Team" icon={<UserCircle className="w-4 h-4" />} />}
            {(['bos_convenor', 'admin'].includes(profile?.role || '')) && <ActionLink href="/dashboard/equivalence" label="Map Equivalence" icon={<Layers className="w-4 h-4" />} />}
            {(['dean_faculty', 'dean_academic', 'admin', 'monitor'].includes(profile?.role || '')) && <ActionLink href="/dashboard/approvals" label="Approval Status" icon={<FileCheck className="w-4 h-4" />} />}
            {(['monitor', 'admin'].includes(profile?.role || '')) && <ActionLink href="/dashboard/audit" label="System Audit" icon={<Hash className="w-4 h-4" />} />}
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
          <div className="p-2 rounded-lg bg-muted">{icon}</div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase">{trend}</span>
        </div>
        <p className="text-2xl font-bold font-headline">{value}</p>
        <p className="text-xs text-muted-foreground">{title}</p>
      </CardContent>
    </Card>
  );
}

function SchemeRow({ id, name, batch, status, code, isVertical, isCommittee }: any) {
  const statusColors: any = { 
    'Draft': 'bg-slate-100 text-slate-700', 
    'Pending Dean': 'bg-amber-100 text-amber-700', 
    'Pending Academics': 'bg-blue-100 text-blue-700', 
    'Approved': 'bg-emerald-100 text-emerald-700' 
  };
  return (
    <Link href={`/dashboard/schemes/${id}`} className={`flex items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors ${isVertical ? 'bg-emerald-50/10 border-emerald-100' : isCommittee ? 'bg-blue-50/10 border-blue-100' : ''}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm">{name}</p>
          {isVertical && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[8px] uppercase font-bold">VERTICAL POOL</Badge>}
          {isCommittee && <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[8px] uppercase font-bold">COMMITTEE POOL</Badge>}
        </div>
        <div className="flex items-center gap-2">
           <p className="text-[10px] text-muted-foreground uppercase font-bold">Batch: {batch}</p>
           <span className="w-1 h-1 rounded-full bg-border"></span>
           <p className="text-[10px] text-primary font-mono font-bold flex items-center gap-1"><Hash className="w-2.5 h-2.5" /> {code || 'N/A'}</p>
        </div>
      </div>
      <Badge variant="secondary" className={`${statusColors[status] || ''} border-none font-bold text-[9px]`}>{status}</Badge>
    </Link>
  );
}

function ActionLink({ href, label, icon }: any) {
  return (
    <Link href={href} className="flex items-center justify-between p-3 rounded-xl border border-border bg-background hover:bg-primary hover:text-white group transition-all">
      <div className="flex items-center gap-3">{icon}<span className="text-sm font-medium">{label}</span></div>
      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}