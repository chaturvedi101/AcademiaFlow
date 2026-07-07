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
import { Plus, Edit3, Loader2, FileText, BookOpen, Eye, CheckCircle2, ShieldCheck, Trash2, RefreshCw, Hash } from "lucide-react";
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

  const [allParentSyllabi, setAllParentSyllabi] = useState<Syllabus[]>([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [selectedScope, setSelectedScope] = useState<SubmissionScope>('Complete');
  const [isSyncing, setIsSyncing] = useState(false);

  // INSTITUTIONAL KNOWLEDGE ENGINE: Proactively fetch potential parents from the entire batch year
  useEffect(() => {
    if (!scheme) return;
    setParentsLoading(true);

    const poolsQuery = query(
      collection(db, 'schemes'),
      where('batchYear', '==', scheme.batchYear)
    );

    let activeUnsubs: Unsubscribe[] = [];

    const unsubPools = onSnapshot(poolsQuery, (snap) => {
      activeUnsubs.forEach(u => u());
      activeUnsubs = [];

      const parentSchemes = snap.docs.filter(d => {
        const data = d.data();
        return data.isVerticalPool || data.isCommitteePool;
      });

      if (parentSchemes.length === 0) {
        setAllParentSyllabi([]);
        setParentsLoading(false);
        return;
      }

      let combinedParents: Syllabus[] = [];
      let schemasProcessed = 0;

      parentSchemes.forEach(ps => {
        const sRef = collection(db, 'schemes', ps.id, 'syllabi');
        const u = onSnapshot(sRef, (sSnap) => {
          const fetched = sSnap.docs.map(d => ({ 
            ...d.data(), 
            id: d.id,
            parentSchemeId: ps.id,
            isAuthoritativeSource: true
          } as Syllabus));
          
          combinedParents = [...combinedParents.filter(c => c.parentSchemeId !== ps.id), ...fetched];
          setAllParentSyllabi([...combinedParents]); // Ensure new array reference for trigger
          
          schemasProcessed++;
          if (schemasProcessed >= parentSchemes.length) setParentsLoading(false);
        }, () => {
          schemasProcessed++;
          if (schemasProcessed >= parentSchemes.length) setParentsLoading(false);
        });
        activeUnsubs.push(u);
      });
    }, () => setParentsLoading(false));

    return () => {
      unsubPools();
      activeUnsubs.forEach(u => u());
    };
  }, [db, scheme]);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);

  // VIRTUAL CHILD RESOLUTION: Merge parent content while keeping local code and semester context
  const syllabi = useMemo(() => {
    if (!scheme) return [];

    const resolvedLocal = localSyllabi.map(local => {
      const parent = local.followedFromId ? allParentSyllabi.find(p => p.id === local.followedFromId) : null;

      if (parent) {
        return {
          ...parent, 
          id: local.id, 
          subjectCode: local.subjectCode, 
          parentCode: parent.subjectCode, 
          semester: local.semester, 
          schemeId: local.schemeId,
          followedFromId: local.followedFromId,
          parentSchemeId: local.parentSchemeId,
          isStandardized: true,
          standardizedFrom: 'Equivalence Manager'
        } as Syllabus;
      }
      return local;
    });

    return resolvedLocal.sort((a, b) => {
      if (a.semester !== b.semester) return (a.semester || 1) - (b.semester || 1);
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
  }, [localSyllabi, allParentSyllabi, scheme]);

  const inheritedCount = useMemo(() => syllabi.filter(s => s.isStandardized).length, [syllabi]);

  const permissions = useMemo(() => {
    const isAdmin = profile?.role === 'admin';
    const isSuper = isAdmin || profile?.role === 'dean_academic';
    
    // Authorization for localized convenors and specialized committee heads
    const canEditScheme = isSuper || 
      (profile?.role === 'bos_convenor' && profile?.managedBranches?.some(m => m.programId === scheme?.programId && m.branch === scheme?.branch)) ||
      (profile?.role === 'committee_convenor' && scheme?.isCommitteePool && scheme?.branch === profile.faculty);
    
    return {
      isAdmin,
      isSuper,
      canEditScheme,
      canDeleteCourse: isAdmin,
      canEditSyllabus: (s: Partial<Syllabus> | undefined) => {
        if (!s) return false;
        if (isSuper) return true;
        // Institutional standards and virtual mirrors are read-only to branch convenors
        if (s.followedFromId || s.isInherited) return false;
        return canEditScheme;
      }
    };
  }, [profile, scheme]);

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, PRJ: 0, total: 0 };
    syllabi.forEach(sub => {
      const cat = sub.creditCategory as keyof typeof dist;
      if (cat in dist) dist[cat] += (sub.credits || 0);
      dist.total += (sub.credits || 0);
    });
    return dist;
  }, [syllabi]);

  const isSchemeValid = useMemo(() => {
    if (scheme?.isVerticalPool || scheme?.isCommitteePool) return true; 
    if (!program?.rules) return false;
    if (selectedScope === 'Year 1') return syllabi.some(s => s.semester === 1) && syllabi.some(s => s.semester === 2);
    return creditDistribution.total === program.rules.totalRequired;
  }, [creditDistribution, program?.rules, scheme, selectedScope, syllabi]);

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
      const isInstitutionalScheme = scheme?.programId === 'INSTITUTIONAL' || scheme?.isVerticalPool || scheme?.isCommitteePool;
      const baseBranchPrefix = isInstitutionalScheme ? 'RT' : (program?.branchPrefixes?.[scheme?.branch || ''] || 'XX');
      const batch = writeBatch(db);
      
      // UNIVERSITY-WIDE UNIQUENESS: Fetch ALL subject codes to ensure global collision avoidance
      const universitySyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      
      const existingGlobalCodes = new Set(universitySyllabiSnap.docs
        .filter(d => d.ref.parent.parent?.id !== schemeId) 
        .map(d => (d.data() as Syllabus).subjectCode)
      );

      const assignedInBatch = new Set<string>();

      for (const sub of localSyllabi) {
        // Rule: Institutional Pool subjects (VAC, AEC, MDC) always use RT prefix university-wide
        const isCommonCategory = ['VAC', 'AEC', 'MDC'].includes(sub.creditCategory);
        const effectivePrefix = isCommonCategory ? 'RT' : baseBranchPrefix;
        
        let sequence = 1;
        let newCode = '';
        
        // Sequence Hunting Algorithm: Find the next available globally unique sequence for this bucket
        while (true) {
          newCode = generateInstitutionalCode(sub, effectivePrefix, sequence);
          if (!existingGlobalCodes.has(newCode) && !assignedInBatch.has(newCode)) {
            break;
          }
          sequence++;
          if (sequence > 99) throw new Error(`CRITICAL: Sequence exhausted for bucket ${newCode.substring(0, 5)}. Global clash limit reached.`);
        }

        assignedInBatch.add(newCode);
        const subRef = doc(db, 'schemes', schemeId, 'syllabi', sub.id);
        batch.update(subRef, { subjectCode: newCode, updatedAt: serverTimestamp() });
      }

      await batch.commit();
      toast({ title: "University-Wide Synchronization Successful", description: "All codes regenerated and verified unique across the institution." });
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
      .then(() => toast({ title: "Authorized & Synchronized" }));
  };

  const handleDeleteSyllabus = async (syllabusId: string) => {
    if (!permissions.isAdmin) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', syllabusId);
    deleteDoc(docRef).then(() => toast({ title: "Subject Removed" }));
  };

  if (profileLoading || schemeLoading || syllabiLoading || parentsLoading) {
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
                {inheritedCount} Institutional Standards Mirroring
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="font-mono font-bold text-primary flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> {scheme.schemeCode}</span>
            <span>Batch: {scheme.batchYear}</span>
            <Badge variant="secondary" className="font-bold">{scheme.status}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {permissions.isAdmin && (
            <Button variant="outline" className="text-primary border-primary/30 gap-2" onClick={handleGlobalSync} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Institutional Sync
            </Button>
          )}
          <Button variant="outline" onClick={() => exportFullSchemeToPDF(scheme, program!, syllabi)}>
            <FileText className="w-4 h-4 mr-2" /> Structure
          </Button>
          <Button variant="outline" onClick={() => exportCompleteSyllabusToPDF(scheme, program!, syllabi)}>
            <BookOpen className="w-4 h-4 mr-2" /> Book
          </Button>
          {permissions.canEditScheme && <Button onClick={() => setIsSubmissionDialogOpen(true)}>Finalize Scheme</Button>}
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
                          <Plus className="w-4 h-4 mr-2" /> Add Subject Slot
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6">Local Code</TableHead>
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
                              <TableCell className="pl-6 font-mono font-bold">
                                <div className="flex flex-col">
                                  <span className={cn(sub.isStandardized && "text-primary")}>{sub.subjectCode}</span>
                                  {sub.parentCode && <span className="text-[9px] text-muted-foreground italic font-normal">Standard: {sub.parentCode}</span>}
                                </div>
                              </TableCell>
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
                                    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                                      <ShieldCheck className="w-3 h-3" />
                                      Mirror
                                    </Badge>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                    {permissions.canEditSyllabus(sub) ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </Button>
                                  {permissions.isAdmin && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteSyllabus(sub.id)}>
                                      <Trash2 className="w-3.5 h-3.5" />
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
              updateDoc(schemeRef, { status: 'Pending Dean', submissionScope: selectedScope });
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
