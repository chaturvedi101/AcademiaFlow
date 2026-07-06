
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, deleteDoc, serverTimestamp, updateDoc, query, where, onSnapshot, Unsubscribe, collectionGroup, getDocs, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Send, Trash2, Edit3, Loader2, FileText, Hash, FileDown, ChevronRight, ChevronDown, Globe, Layers, BookOpen, Eye, Clock, Info, RefreshCw, CheckCircle2, Link as LinkIcon } from "lucide-react";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, Program, UserProfile, CreditCategory, SubmissionScope } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { exportSyllabusToPDF, exportFullSchemeToPDF, exportCompleteSyllabusToPDF } from "@/lib/pdf-export";

export default function SchemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: schemeId } = React.use(params);
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const schemeRef = useMemoFirebase(() => doc(db, 'schemes', schemeId), [db, schemeId]);
  const { data: scheme, loading: schemeLoading } = useDoc<Scheme>(schemeRef);

  const syllabiRef = useMemoFirebase(() => collection(db, 'schemes', schemeId, 'syllabi'), [db, schemeId]);
  const { data: localSyllabi, loading: syllabiLoading } = useCollection<Syllabus>(syllabiRef);

  const programRef = useMemoFirebase(() => (scheme?.programId && scheme.programId !== 'INSTITUTIONAL' ? doc(db, 'programs', scheme.programId) : null), [db, scheme?.programId]);
  const { data: program } = useDoc<Program>(programRef);

  const [poolSyllabi, setPoolSyllabi] = useState<Syllabus[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [isResyncing, setIsResyncing] = useState(false);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState<SubmissionScope>('Complete');

  // Pool Discovery: AEC/VAC Pool + ALL Committee Pools for resolving equivalences
  useEffect(() => {
    if (!scheme) return;
    setPoolLoading(true);

    const isManagementVertical = 
      program?.faculty.toLowerCase().includes('management') || 
      program?.faculty.toLowerCase().includes('bba') ||
      program?.name.toLowerCase().includes('bba') ||
      scheme.branch?.toLowerCase().includes('bba');
    
    const targetPoolBranch = isManagementVertical ? 'BBA (Common BOS) Pool' : 'B.Tech (Common BOS) Pool';

    // Query both the specific vertical pool and ALL committee pools for this batch
    const poolQuery = query(
      collection(db, 'schemes'),
      where('batchYear', '==', scheme.batchYear),
      where('status', 'in', ['Draft', 'Pending Dean', 'Pending Academics', 'Approved'])
    );

    let unsubSyllabi: Unsubscribe[] = [];

    const unsubscribeSchemes = onSnapshot(poolQuery, (snap) => {
      unsubSyllabi.forEach(u => u());
      unsubSyllabi = [];
      
      const poolSchemeIds = snap.docs
        .filter(d => d.id !== schemeId)
        .filter(d => d.data().isCommonPoolScheme || d.data().isCommitteePool)
        .map(d => d.id);
      
      if (poolSchemeIds.length === 0) {
        setPoolSyllabi([]);
        setPoolLoading(false);
        return;
      }

      const syllabiByScheme: Record<string, Syllabus[]> = {};

      poolSchemeIds.forEach(psId => {
        const sRef = collection(db, 'schemes', psId, 'syllabi');
        const u = onSnapshot(sRef, (sSnap) => {
          syllabiByScheme[psId] = sSnap.docs.map(d => ({ ...d.data(), id: d.id, parentSchemeId: psId } as Syllabus));
          const allPool = Object.values(syllabiByScheme).flat();
          setPoolSyllabi(allPool);
          setPoolLoading(false);
        });
        unsubSyllabi.push(u);
      });
    }, (err) => {
      console.error("Pool discovery failed:", err);
      setPoolLoading(false);
    });

    return () => {
      unsubscribeSchemes();
      unsubSyllabi.forEach(u => u());
    };
  }, [db, scheme, program, schemeId]);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const branchPrefix = useMemo(() => {
    if (!scheme) return 'XX';
    if (scheme.isCommonPoolScheme) return 'GN';
    if (scheme.isCommitteePool) {
      const parts = scheme.branch?.split('-') || [];
      const name = parts[parts.length - 1]?.trim().toUpperCase() || 'CM';
      return name.substring(0, 2);
    }
    if (!program) return 'XX';
    return program.branchPrefixes?.[scheme.branch || ''] || scheme.branch?.substring(0, 2).toUpperCase() || 'XX';
  }, [scheme, program]);

  // RESOLUTION ENGINE: Equivalence (Parent-Child) & Pool Injection
  const syllabi = useMemo(() => {
    const finalSyllabi = localSyllabi.map(local => {
      // 1. Resolve Equivalence (Parent-Child)
      if (local.followedFromId) {
        const parent = poolSyllabi.find(p => p.id === local.followedFromId);
        if (parent) {
          return {
            ...local,
            // Inherit standard identity & content
            title: parent.title,
            subjectCode: parent.subjectCode,
            units: parent.units,
            textBooks: parent.textBooks,
            referenceBooks: parent.referenceBooks,
            lectureCredits: parent.lectureCredits,
            tutorialCredits: parent.tutorialCredits,
            practicalCredits: parent.practicalCredits,
            credits: parent.credits,
            type: parent.type,
            isLinkedToParent: true // Custom flag for UI
          };
        }
      }

      // 2. Resolve Slot Injections from Vertical Pool (AEC/VAC/MDC)
      if (local.isSlot || local.isOFESlot) {
        const poolMatch = poolSyllabi.find(p => p.subjectCode === local.subjectCode && p.creditCategory === local.creditCategory);
        if (poolMatch) {
          return {
            ...local,
            title: poolMatch.title,
            units: poolMatch.units,
            textBooks: poolMatch.textBooks,
            referenceBooks: poolMatch.referenceBooks,
            isFromPool: true
          };
        }
      }

      return local;
    });

    return finalSyllabi.sort((a, b) => {
      if ((a.semester || 1) !== (b.semester || 1)) return (a.semester || 1) - (b.semester || 1);
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
  }, [localSyllabi, poolSyllabi]);

  const permissions = useMemo(() => {
    if (profileLoading || !profile || !scheme) return { 
      canEditScheme: false, canDeleteSyllabus: (s: any) => false, canEditSyllabus: (s: any) => false,
      isMonitor: false, isSuperuser: false, isAdmin: false
    };

    const isAdmin = profile.role === 'admin';
    const isSuperuser = ['admin', 'dean_academic'].includes(profile.role);
    if (profile.role === 'monitor') return { canEditScheme: false, canDeleteSyllabus: () => false, canEditSyllabus: () => false, isMonitor: true, isSuperuser: false, isAdmin: false };

    const isProgramDean = profile.role === 'dean_faculty' && program && profile.faculty === program.faculty;
    const isCommonBOS = !!profile.faculty?.includes('(Common BOS)');
    const isMyCommittee = profile.role === 'committee_convenor' && profile.faculty === scheme.branch;

    const myBranchRole = profile.managedBranches?.find(m => m.programId === scheme.programId && m.branch === scheme.branch)?.role;
    const canEditScheme = isSuperuser || isProgramDean || isMyCommittee || (scheme.isCommonPoolScheme ? isCommonBOS : myBranchRole === 'bos_convenor');

    const canEditSyllabus = (s: any) => {
      if (isSuperuser) return true;
      if (isMyCommittee) return true;
      // If course is linked to a parent, local editing of content is disabled
      if (s?.followedFromId) return false;
      const isInstitutional = ['AEC', 'VAC', 'MDC'].includes(s?.creditCategory);
      if (isInstitutional && scheme.isCommonPoolScheme) return isCommonBOS;
      return isProgramDean || !!myBranchRole || canEditScheme;
    };

    const canDeleteSyllabus = (s: any) => {
      if (isSuperuser) return true;
      if (isMyCommittee) return true;
      return canEditScheme;
    };

    return { canEditScheme, canDeleteSyllabus, canEditSyllabus, isMonitor: false, isSuperuser, isAdmin };
  }, [profile, profileLoading, scheme, program]);

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, PRJ: 0, total: 0 };
    const countedGroups = new Set<string>();

    syllabi.forEach(sub => {
      const cat = sub.creditCategory as keyof typeof dist;
      if (sub.isOFEContribution) return;

      if (sub.electiveGroupId && !['DSC', 'PRJ', 'SEC'].includes(sub.creditCategory)) {
        if (!countedGroups.has(sub.electiveGroupId)) {
          dist[cat] = (dist[cat] || 0) + (sub.credits || 0);
          dist.total += (sub.credits || 0);
          countedGroups.add(sub.electiveGroupId);
        }
      } else {
        if (cat in dist) dist[cat] = (dist[cat] || 0) + (sub.credits || 0);
        dist.total += (sub.credits || 0);
      }
    });
    return dist;
  }, [syllabi]);

  const isSchemeValid = useMemo(() => {
    if (scheme?.isCommonPoolScheme || scheme?.isCommitteePool) return true; 
    if (!program?.rules) return false;
    
    if (selectedScope === 'Year 1') return syllabi.filter(s => s.semester <= 2).length > 0;
    if (selectedScope === 'Year 2') return syllabi.filter(s => s.semester <= 4).length > 0;
    if (selectedScope === 'Year 3') return syllabi.filter(s => s.semester <= 6).length > 0;

    return creditDistribution.total === program.rules.totalRequired;
  }, [creditDistribution, program?.rules, scheme, selectedScope, syllabi]);

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    if (!permissions.canEditScheme) return;
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    const docId = data.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', docId);
    setDoc(docRef, { ...data, id: docId, schemeId, updatedAt: serverTimestamp() }, { merge: true })
      .then(() => toast({ title: "Synchronized" }));
  };

  const handleDeleteSyllabus = (id: string) => {
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', id);
    deleteDoc(docRef).then(() => toast({ title: "Deleted" }));
  };

  if (profileLoading || schemeLoading || syllabiLoading || poolLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!scheme) return <div className="p-8 text-center">Scheme not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold">{scheme.branch || program?.name}</h1>
            {scheme.isCommonPoolScheme && <Badge className="bg-emerald-100 text-emerald-700">VERTICAL POOL</Badge>}
            {scheme.isCommitteePool && <Badge className="bg-blue-100 text-blue-700">COMMITTEE POOL</Badge>}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="font-mono font-bold">{scheme.schemeCode}</span>
            <span>Batch: {scheme.batchYear}</span>
            <Badge variant="secondary">{scheme.status} {scheme.submissionScope ? `(${scheme.submissionScope})` : ''}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => exportFullSchemeToPDF(scheme, program!, syllabi)}><FileText className="w-4 h-4 mr-2" /> Export Structure</Button>
          <Button variant="outline" onClick={() => exportCompleteSyllabusToPDF(scheme, program!, syllabi)}><BookOpen className="w-4 h-4 mr-2" /> Syllabus Book</Button>
          {permissions.canEditScheme && <Button onClick={() => setIsSubmissionDialogOpen(true)}>Submit Framework</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-3">
          <Tabs defaultValue="syllabi">
            <TabsList className="bg-white border w-full justify-start">
              <TabsTrigger value="syllabi">Course Structure</TabsTrigger>
            </TabsList>
            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {Array.from({ length: scheme.isCommitteePool ? 1 : (program?.totalSemesters || 8) }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => (scheme.isCommitteePool ? true : s.semester === sem));
                return (
                  <Card key={sem} className="shadow-sm border-none overflow-hidden">
                    <CardHeader className="bg-muted/20 py-4 px-6 flex flex-row items-center justify-between">
                      <CardTitle className="text-lg">{scheme.isCommitteePool ? 'Pool Subjects' : `Semester ${sem}`}</CardTitle>
                      {permissions.canEditScheme && (
                        <Button size="sm" variant="outline" onClick={() => { setActiveSubject({ semester: sem }); setIsSyllabusDialogOpen(true); }}>
                          <Plus className="w-4 h-4 mr-2" /> Add Subject
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6">Code</TableHead>
                            <TableHead>Subject Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">L-T-P</TableHead>
                            <TableHead className="text-right">Cr</TableHead>
                            <TableHead className="text-right pr-6">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {semSyllabi.map(sub => (
                            <TableRow key={sub.id} className="group">
                              <TableCell className="pl-6 font-mono font-bold">{sub.subjectCode}</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{sub.title}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase">{sub.type}</span>
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="secondary" className="text-[9px]">{sub.creditCategory}</Badge></TableCell>
                              <TableCell className="text-center text-xs">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell>
                              <TableCell className="text-right font-bold">{sub.credits}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end items-center gap-2">
                                  {sub.followedFromId && <Badge variant="outline" className="bg-blue-50 text-blue-700 gap-1"><LinkIcon className="w-3 h-3" /> Linked</Badge>}
                                  {permissions.canEditSyllabus(sub) ? (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          {!scheme.isCommonPoolScheme && !scheme.isCommitteePool && (
            <CreditValidator currentCredits={creditDistribution} rules={program?.rules} />
          )}
        </div>
      </div>

      <Dialog open={isSubmissionDialogOpen} onOpenChange={setIsSubmissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Scope</DialogTitle>
            <DialogDescription>Select which part of the scheme is finalized for implementation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedScope} onValueChange={(v: any) => setSelectedScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Year 1">Year 1 (Sems 1-2)</SelectItem>
                <SelectItem value="Year 2">Year 2 (Sems 1-4)</SelectItem>
                <SelectItem value="Year 3">Year 3 (Sems 1-6)</SelectItem>
                <SelectItem value="Complete">Complete Degree Structure</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={!isSchemeValid} onClick={() => {
              handleUpdateScheme({ status: 'Pending Dean', submissionScope: selectedScope });
              setIsSubmissionDialogOpen(false);
            }}>Finalize & Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SyllabusDialog 
        open={isSyllabusDialogOpen} 
        onOpenChange={setIsSyllabusDialogOpen} 
        syllabus={activeSubject}
        onSave={handleSaveSyllabus}
        canEdit={permissions.canEditSyllabus(activeSubject)}
        userProfile={profile || undefined}
        batchYear={scheme.batchYear}
      />
    </div>
  );
}
