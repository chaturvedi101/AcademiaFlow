'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, orderBy } from 'firebase/firestore';
import { Feedback, Scheme, Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Loader2, Calendar, User, Mail, Phone, BookOpen, AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FeedbackVaultPage() {
  const db = useFirestore();
  const { user } = useUser();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const feedbackQuery = useMemoFirebase(() => {
    return query(collection(db, 'feedback'), orderBy('createdAt', 'desc'));
  }, [db]);

  const { data: allFeedback, loading: feedbackLoading } = useCollection<Feedback>(feedbackQuery);
  const { data: schemes } = useCollection<Scheme>(useMemoFirebase(() => collection(db, 'schemes'), [db]));
  const { data: programs } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));

  const jurisdictionalFeedback = useMemo(() => {
    if (!profile || !schemes.length || !programs.length || !allFeedback.length) return [];

    // Global authorities see everything
    if (profile.role === 'admin' || profile.role === 'dean_academic' || profile.role === 'monitor') return allFeedback;

    const isBTECHTier = profile.faculty?.includes('BTECH');
    const isBBATier = profile.faculty?.includes('BBA');
    const isScienceDean = profile.role === 'dean_faculty' && profile.faculty === 'Faculty of Sciences';

    // Identify which schemes are in the user's jurisdiction
    const authorizedSchemeIds = new Set(schemes.filter(s => {
      // Pool Logic
      if (s.programId === 'INSTITUTIONAL') {
        if (isScienceDean) {
           const scienceCommittees = ['Course Committee - Physics', 'Course Committee - Chemistry', 'Course Committee - Mathematics'];
           if (scienceCommittees.includes(s.branch || '')) return true;
        }
        if (isBTECHTier && (s.branch?.includes('BTECH') || s.isVerticalPool)) return true;
        if (isBBATier && (s.branch?.includes('BBA') || s.isVerticalPool)) return true;
        return false;
      }

      // Program Logic
      const prog = programs.find(p => p.id === s.programId);
      if (!prog) return false;
      
      if (profile.role === 'dean_faculty' && prog.faculty === profile.faculty) return true;
      if (isBTECHTier && prog.faculty.includes('BTECH')) return true;
      if (isBBATier && prog.faculty.includes('Management')) return true;

      // Branch Personnel
      return profile.managedBranches?.some(m => m.programId === s.programId && m.branch === s.branch);
    }).map(s => s.id));

    return allFeedback.filter(f => authorizedSchemeIds.has(f.schemeId));
  }, [allFeedback, profile, schemes, programs]);

  if (feedbackLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Institutional Feedback Vault</h1>
        <p className="text-muted-foreground">Pedagogical observations and technical recommendations from public stakeholders.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-primary/10 bg-gradient-to-br from-white to-primary/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Audit Purview
              </CardTitle>
              <CardDescription>Jurisdictional Oversight</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Reviewing As</p>
                <p className="text-sm font-bold text-primary">{profile?.displayName}</p>
                <Badge variant="secondary" className="uppercase text-[9px]">{profile?.role?.replace('_', ' ')}</Badge>
              </div>
              <div className="p-4 bg-white border rounded-xl space-y-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Statistics</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-muted-foreground">Entries in Scope:</span>
                  <span className="text-sm font-black">{jurisdictionalFeedback.length}</span>
                </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-[10px] text-blue-800 leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 text-blue-600" />
                <p>Use these observations to refine pedagogical units during the next **Board of Studies (BoS)** revision cycle.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Observation Registry
              </CardTitle>
              <CardDescription>Filtered list of entries targeting your authorized technical branches.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="divide-y">
                  {jurisdictionalFeedback.map((entry) => {
                    const targetScheme = schemes.find(s => s.id === entry.schemeId);
                    const targetProgram = programs.find(p => p.id === targetScheme?.programId);
                    
                    return (
                      <div key={entry.id} className="p-6 space-y-4 hover:bg-muted/5 transition-colors group">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-primary" />
                              <span className="font-bold text-sm">{entry.name}</span>
                              <Badge variant="outline" className="text-[10px] bg-white">{entry.email}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                              <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {entry.phone}</div>
                              <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {entry.createdAt?.toDate().toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-bold">{targetScheme?.branch || 'General'}</span>
                            </div>
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                              {targetProgram?.code || 'INSTITUTIONAL POOL'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-muted/20 rounded-2xl border-l-4 border-primary italic">
                          <p className="text-sm text-foreground/90 leading-relaxed">
                            "{entry.feedback}"
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {jurisdictionalFeedback.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-40 text-muted-foreground space-y-4">
                      <MessageSquare className="w-12 h-12 opacity-10" />
                      <div className="text-center">
                        <p className="font-bold text-sm">No observations recorded.</p>
                        <p className="text-[10px] opacity-60">Public stakeholders have not yet submitted feedback for your jurisdiction.</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
