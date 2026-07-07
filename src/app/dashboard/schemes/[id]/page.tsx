"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, serverTimestamp, updateDoc, query, where, onSnapshot, Unsubscribe, deleteDoc, getDocs, collectionGroup, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit3, Loader2, FileText, BookOpen, Eye, CheckCircle2, ShieldCheck, Trash2, RefreshCw } from "lucide-react";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, Program, UserProfile, SubmissionScope, CreditCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { exportFullSchemeToPDF, exportCompleteSyllabusToPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";

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
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState<SubmissionScope>('Complete');
  const [isSyncing, setIsSyncing] = useState(false);

  // AUTOMATED VERTICAL INHERITANCE ENGINE (BTECH STANDARDIZED)
  useEffect(() => {
    if (!scheme) return;
    setPoolLoading(true);

    const verticalKey = 'BTECH'; 

    if (scheme.programId === 'INSTITUTIONAL' || scheme.isVerticalPool || scheme.isCommitteePool) {
      setPoolSyllabi([]);
      setPoolLoading(false);
      return;
    }

    const poolQuery = query(
      collection(db, 'schemes'),
      where('batchYear', '==', scheme.batchYear),
      where('isVerticalPool', '==', true)
    );

    let unsubSyllabi: Unsubscribe[] = [];

    const unsubscribePools = onSnapshot(poolQuery, (snap) => {
      unsubSyllabi.forEach(u => u());
      unsubSyllabi = [];

      const poolDoc = snap.docs.find(d => {
        const normalizedBranch = (d.data().branch || '').toUpperCase();
        return normalizedBranch.includes(verticalKey);
      });
      
      if (!poolDoc) {
        setPoolSyllabi([]);
        setPoolLoading(false);
        return;
      }

      const sRef = collection(db, 'schemes', poolDoc.id, 'syllabi');
      const u = onSnapshot(sRef, (sSnap) => {
        setPoolSyllabi(sSnap.docs.map(d => ({ 
          ...d.data(), 
          id: d.id, 
          fromVerticalPool: true,
          parentPoolId: poolDoc.id
        } as any)));
        setPoolLoading(false);
      }, (err) => {
        setPoolLoading(false);
      });
      unsubSyllabi.push(u);
    }, (err) => {
      setPoolLoading(false);
    });

    return () => {
      unsubscribePools();
      unsubSyllabi.forEach(u => u());
    };
  }, [db, scheme]);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);

  const syllabi = useMemo(() => {
    if (!scheme) return [];

    const resolvedLocal = localSyllabi.map(local => {
      const parent = local.followedFromId ? poolSyllabi.find(p => p.id === local.followedFromId) : 
                     (local.subjectCode ? poolSyllabi.find(p => p.subjectCode === local.subjectCode) : null);

      if (parent) {
        return {
          ...local,
          ...parent, 
          id: local.id, 
          isStandardized: true,
          standardizedFrom: local.followedFromId ? 'Equivalence Link' : 'Code Match'
        };
      }
      return local;
    });

    const missingFromPool = poolSyllabi.filter(p => !resolvedLocal.some(l => l.subjectCode === p.subjectCode));
    
    const inheritedFromPool = missingFromPool.map(p => ({
      ...p,
      isStandardized: true,
      standardizedFrom: 'Institutional Common Pool (Auto)',
      isInherited: true
    }));

    return [...resolvedLocal, ...inheritedFromPool].sort((a, b) => {
      if ((a.semester || 1) !== (b.semester || 1)) return (a.semester || 1) - (b.semester || 1);
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
  }, [localSyllabi, poolSyllabi, scheme]);

  const inheritedCount = useMemo(() => syllabi.filter(s => (s as any).isInherited || (s as any).isStandardized).length, [syllabi]);

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
    const canEditScheme = isSuperuser || isProgramDean || isMyCommittee || (scheme.isVerticalPool ? isCommonBOS : myBranchRole === 'bos_convenor');

    const canEditSyllabus = (s: any) => {
      if (isSuperuser) return true;
      if (isMyCommittee) return true;
      if (s?.isInherited) return false; 
      return isProgramDean || !!myBranchRole || canEditScheme;
    };

    const canDeleteSyllabus = (s: any) => isAdmin;

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
    if (scheme?.isVerticalPool || scheme?.isCommitteePool) return true; 
    if (!program?.rules) return false;
    
    if (selectedScope === 'Year 1') return syllabi.some(s => s.semester === 1) && syllabi.some(s => s.semester === 2);
    return creditDistribution.total === program.rules.totalRequired;
  }, [creditDistribution, program?.rules, scheme, selectedScope, syllabi]);

  // INSTITUTIONAL CODE GENERATION RULES (RT for POOL)
  const generateInstitutionalCode = (sub: Partial<Syllabus>, branchPrefix: string, sequence: number) => {
    const pedagogyChar = sub.type === 'Lab/Sessional' ? 'P' : (sub.creditCategory === 'PRJ' ? 'I' : 'L');
    const getPillarChar = (cat: CreditCategory) => {
      switch(cat) {
        case 'DSC': return 'C';
        case 'DSE': case 'OFE': return 'E';
        case 'SEC': return 'S';
        case 'VAC': return 'V';
        case 'AEC': return 'A';
        case 'MDC': return 'M';
        case 'PRJ': return 'P';
        default: return 'C';
      }
    };
    const pillarChar = getPillarChar(sub.creditCategory || 'DSC');
    const yearDigit = Math.ceil((sub.semester || 1) / 2);
    const seqStr = sequence.toString().padStart(2, '0');
    return `${branchPrefix}${pedagogyChar}${pillarChar}${yearDigit}${seqStr}`;
  };

  const handleGlobalSync = async () => {
    if (!permissions.isAdmin) return;
    setIsSyncing(true);
    
    try {
      const isInstitutional = scheme?.programId === 'INSTITUTIONAL' || scheme?.isVerticalPool || scheme?.isCommitteePool;
      const branchPrefix = isInstitutional ? 'RT' : (program?.branchPrefixes?.[scheme?.branch || ''] || 'XX');
      const batch = writeBatch(db);
      
      const universitySyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      const existingCodes = new Set(universitySyllabiSnap.docs
        .filter(d => d.ref.parent.parent?.id !== schemeId) 
        .map(d => (d.data() as Syllabus).subjectCode)
      );

      const sequenceMap: Record<string, number> = {};

      for (const sub of localSyllabi) {
        const bucketKey = `${sub.type}-${sub.creditCategory}-${sub.semester}`;
        sequenceMap[bucketKey] = (sequenceMap[bucketKey] || 0) + 1;
        
        const newCode = generateInstitutionalCode(sub, branchPrefix, sequenceMap[bucketKey]);
        
        if (existingCodes.has(newCode)) {
          throw new Error(`CLASH: Generated code ${newCode} for "${sub.title}" is already in use by another scheme in the University.`);
        }

        const subRef = doc(db, 'schemes', schemeId, 'syllabi', sub.id);
        batch.update(subRef, { subjectCode: newCode, updatedAt: serverTimestamp() });
      }

      await batch.commit();
      toast({ title: "Institutional Sync Complete" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    const docId = data.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', docId);
    setDoc(docRef, { ...data, id: docId, schemeId, updatedAt: serverTimestamp() }, { merge: true })
      .then(() => toast({ title: "Synchronized" }));
  };

  const handleDeleteSyllabus = async (syllabusId: string) => {
    if (!permissions.isAdmin) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', syllabusId);
    deleteDoc(docRef).then(() => toast({ title: "Subject Removed" }));
  };

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() })
      .then(() => toast({ title: "Scheme Advanced" }));
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
            {scheme.isVerticalPool && <Badge className="bg-emerald-100 text-emerald-700">VERTICAL POOL</Badge>}
            {scheme.isCommitteePool && <Badge className="bg-blue-100 text-blue-700">COMMITTEE POOL</Badge>}
            {inheritedCount > 0 && (
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 gap-1.5 py-1 px-3">
                <ShieldCheck className="w-3 h-3" />
                {inheritedCount} Institutional Courses Synchronized
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="font-mono font-bold">{scheme.schemeCode}</span>
            <span>Batch: {scheme.batchYear}</span>
            <Badge variant="secondary">{scheme.status} {scheme.submissionScope ? `(${scheme.submissionScope})` : ''}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {permissions.isAdmin && (
            <Button variant="outline" className="text-primary border-primary/30 gap-2" onClick={handleGlobalSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Global Sync
            </Button>
          )}
          <Button variant="outline" onClick={() => exportFullSchemeToPDF(scheme, program!, syllabi)}>
            <FileText className="w-4 h-4 mr-2" /> Structure
          </Button>
          <Button variant="outline" onClick={() => exportCompleteSyllabusToPDF(scheme, program!, syllabi)}>
            <BookOpen className="w-4 h-4 mr-2" /> Book
          </Button>
          {permissions.canEditScheme && <Button onClick={() => setIsSubmissionDialogOpen(true)}>Submit Scheme</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-3">
          <Tabs defaultValue="syllabi">
            <TabsList className="bg-white border w-full justify-start">
              <TabsTrigger value="syllabi">Curriculum Layout</TabsTrigger>
            </TabsList>
            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {Array.from({ length: scheme.isCommitteePool ? 1 : (program?.totalSemesters || 8) }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => (scheme.isCommitteePool ? true : s.semester === sem));
                const semTotalCredits = semSyllabi.reduce((sum, s) => sum + (s.credits || 0), 0);

                return (
                  <Card key={sem} className="shadow-sm border-none overflow-hidden">
                    <CardHeader className="bg-muted/20 py-4 px-6 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CardTitle className="text-lg">{scheme.isCommitteePool ? 'Course Registry' : `Semester ${sem}`}</CardTitle>
                        {!scheme.isCommitteePool && (
                          <Badge variant="secondary" className="bg-white/50 text-primary border-primary/20">
                            Total: {semTotalCredits} Credits
                          </Badge>
                        )}
                      </div>
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
                            <TableHead>Course Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">L-T-P</TableHead>
                            <TableHead className="text-right">Cr</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
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
                                  {sub.isStandardized && (
                                    <Badge variant="outline" className={cn(
                                      "gap-1 border-emerald-200",
                                      (sub as any).isInherited ? "bg-primary/5 text-primary border-primary/20" : "bg-emerald-50 text-emerald-700"
                                    )} title={`Standardized via ${sub.standardizedFrom}`}>
                                      {(sub as any).isInherited ? <ShieldCheck className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                      {(sub as any).isInherited ? "Institutional" : "Standardized"}
                                    </Badge>
                                  )}
                                  {permissions.canEditSyllabus(sub) ? (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </Button>
                                  ) : (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                  {permissions.canDeleteSyllabus(sub) && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteSyllabus(sub.id)}>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {semSyllabi.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground italic">
                                No subjects added for this semester.
                              </TableCell>
                            </TableRow>
                          )}
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
          {!scheme.isVerticalPool && !scheme.isCommitteePool && (
            <CreditValidator currentCredits={creditDistribution} rules={program?.rules} />
          )}
        </div>
      </div>

      <Dialog open={isSubmissionDialogOpen} onOpenChange={setIsSubmissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Scope</DialogTitle>
            <DialogDescription>Finalize academic framework implementation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedScope} onValueChange={(v: any) => setSelectedScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Year 1">Year 1 (Semester 1 & 2)</SelectItem>
                <SelectItem value="Year 2">Up to Year 2 (Semesters 1-4)</SelectItem>
                <SelectItem value="Year 3">Up to Year 3 (Semesters 1-6)</SelectItem>
                <SelectItem value="Complete">Complete 4-Year Framework</SelectItem>
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
        program={program || undefined}
        scheme={scheme}
      />
    </div>
  );
}