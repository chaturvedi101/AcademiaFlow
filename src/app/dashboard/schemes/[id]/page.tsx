
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
import { Plus, Send, Trash2, Edit3, Loader2, FileText, Hash, FileDown, ChevronRight, ChevronDown, Globe, Layers, BookOpen, Eye, Clock, Info, RefreshCw, CheckCircle2 } from "lucide-react";
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

  useEffect(() => {
    if (!scheme) return;
    if (scheme.isCommonPoolScheme) return; // Pools don't inherit from other pools

    setPoolLoading(true);

    // Logic to find the matching institutional pool vertical
    const isManagementVertical = 
      program?.faculty.toLowerCase().includes('management') || 
      program?.faculty.toLowerCase().includes('bba') ||
      program?.name.toLowerCase().includes('bba') ||
      scheme.branch?.toLowerCase().includes('bba');
    
    const targetPoolBranch = isManagementVertical ? 'BBA (Common BOS) Pool' : 'B.Tech (Common BOS) Pool';

    const poolQuery = query(
      collection(db, 'schemes'),
      where('batchYear', '==', scheme.batchYear),
      where('isCommonPoolScheme', '==', true),
      where('branch', '==', targetPoolBranch)
    );

    let unsubSyllabi: Unsubscribe[] = [];

    const unsubscribeSchemes = onSnapshot(poolQuery, (poolSnap) => {
      unsubSyllabi.forEach(u => u());
      unsubSyllabi = [];
      
      const poolSchemeIds = poolSnap.docs.map(d => d.id).filter(id => id !== schemeId);
      
      if (poolSchemeIds.length === 0) {
        setPoolSyllabi([]);
        setPoolLoading(false);
        return;
      }

      const syllabiByScheme: Record<string, Syllabus[]> = {};

      poolSchemeIds.forEach(psId => {
        const sRef = collection(db, 'schemes', psId, 'syllabi');
        const u = onSnapshot(sRef, (sSnap) => {
          syllabiByScheme[psId] = sSnap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus));
          const allPool = Object.values(syllabiByScheme).flat();
          setPoolSyllabi(allPool);
          setPoolLoading(false);
        }, (err) => {
          console.error(`Pool sync failed for scheme ${psId}:`, err);
        });
        unsubSyllabi.push(u);
      });
    }, (err) => {
      console.error("Pool scheme discovery failed:", err);
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
    if (!program) return 'XX';
    return program.branchPrefixes?.[scheme.branch || ''] || scheme.branch?.substring(0, 2).toUpperCase() || 'XX';
  }, [scheme, program]);

  const syllabi = useMemo(() => {
    const uniqueMap = new Map<string, Syllabus>();
    
    // 1. Initial Load from Local Branch Scheme
    localSyllabi.forEach(s => {
      const key = s.subjectCode || s.id;
      uniqueMap.set(key, s);
    });

    // 2. Enrich with Content from Institutional Pool (only for departmental schemes)
    if (scheme && !scheme.isCommonPoolScheme) {
      poolSyllabi.forEach(poolSub => {
        const key = poolSub.subjectCode || poolSub.id;
        const existing = uniqueMap.get(key);
        
        if (!existing) {
          uniqueMap.set(key, poolSub);
          return;
        }

        const existingIsPlaceholder = existing.isSlot || existing.isOFESlot || !existing.units || existing.units.length === 0;
        const poolHasContent = poolSub.units && poolSub.units.length > 0;

        if (existingIsPlaceholder && poolHasContent) {
          uniqueMap.set(key, poolSub);
        }
      });
    }

    return Array.from(uniqueMap.values()).sort((a, b) => {
      if ((a.semester || 1) !== (b.semester || 1)) {
        return (a.semester || 1) - (b.semester || 1);
      }
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
  }, [localSyllabi, poolSyllabi, scheme]);

  const permissions = useMemo(() => {
    if (profileLoading || !profile || !scheme) return { 
      canEditScheme: false, 
      canDeleteSyllabus: (s: any) => false, 
      canEditSyllabus: (s: any) => false,
      isMonitor: false,
      isSuperuser: false,
      isAdmin: false
    };

    const isAdmin = profile.role === 'admin';
    const isSuperuser = ['admin', 'dean_academic'].includes(profile.role);
    if (profile.role === 'monitor') {
      return { canEditScheme: false, canDeleteSyllabus: () => false, canEditSyllabus: () => false, isMonitor: true, isSuperuser: false, isAdmin: false };
    }

    const isProgramDean = profile.role === 'dean_faculty' && program && profile.faculty === program.faculty;
    const isCommonBOS = !!profile.faculty?.includes('(Common BOS)');
    const isCommonBOSConvenor = isCommonBOS && profile.role === 'bos_convenor';
    const myBranchRole = profile.managedBranches?.find(m => m.programId === scheme.programId && m.branch === scheme.branch)?.role;

    const canEditScheme = isSuperuser || isProgramDean || (scheme.isCommonPoolScheme ? isCommonBOS : myBranchRole === 'bos_convenor');

    const canEditSyllabus = (s: any) => {
      if (isSuperuser) return true;
      const isInstitutional = ['AEC', 'VAC', 'MDC'].includes(s?.creditCategory);
      if (isInstitutional && scheme.isCommonPoolScheme) return isCommonBOS;
      return isProgramDean || !!myBranchRole || canEditScheme;
    };

    const canDeleteSyllabus = (s: any) => {
      if (isSuperuser) return true;
      if (isCommonBOSConvenor && scheme.isCommonPoolScheme) {
        return profile.faculty === scheme.branch?.replace(' Pool', '');
      }
      return false;
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
    if (scheme?.isCommonPoolScheme) return true; // Pools don't have a rigid credit total requirement
    if (!program?.rules) return false;
    
    // Yearly phased validation logic
    if (selectedScope === 'Year 1') {
      const year1Syllabi = syllabi.filter(s => s.semester <= 2 && !s.isOFEContribution);
      return year1Syllabi.length > 0 && year1Syllabi.every(s => !s.isSlot && (s.units?.length || 0) > 0);
    }
    if (selectedScope === 'Year 2') {
      const year2Syllabi = syllabi.filter(s => s.semester <= 4 && !s.isOFEContribution);
      return year2Syllabi.length > 0 && year2Syllabi.every(s => !s.isSlot && (s.units?.length || 0) > 0);
    }
    if (selectedScope === 'Year 3') {
      const year3Syllabi = syllabi.filter(s => s.semester <= 6 && !s.isOFEContribution);
      return year3Syllabi.length > 0 && year3Syllabi.every(s => !s.isSlot && (s.units?.length || 0) > 0);
    }

    // Complete Validation
    return creditDistribution.total === program.rules.totalRequired;
  }, [creditDistribution, program?.rules, scheme, selectedScope, syllabi]);

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    if (!permissions.canEditScheme) return;
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const handleSubmitScheme = () => {
    handleUpdateScheme({ status: 'Pending Dean', submissionScope: selectedScope });
    setIsSubmissionDialogOpen(false);
    toast({ title: "Scheme Submitted", description: `Framework submitted for approval with scope: ${selectedScope}` });
  };

  const handleResyncCodes = async () => {
    if (!permissions.isAdmin) return;
    if (!window.confirm("This will systematically re-generate all Course Codes in this local scheme. Elective groups will share a base code with incrementing suffixes. Proceed?")) return;
    
    setIsResyncing(true);
    try {
      const allSyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      const globalUsedCodes = new Set(
        allSyllabiSnap.docs
          .filter(d => d.ref.parent.parent?.id !== schemeId)
          .map(d => d.data().subjectCode as string)
      );

      const batch = writeBatch(db);
      const usedSuffixesInScheme = new Map<number, Set<string>>();
      
      const groupBaseCodes = new Map<string, string>();
      const groupCounters = new Map<string, number>();

      const sortedLocal = [...localSyllabi].sort((a, b) => {
        if (a.semester !== b.semester) return a.semester - b.semester;
        return a.creditCategory.localeCompare(b.creditCategory);
      });

      for (const sub of sortedLocal) {
        const cat = sub.creditCategory as CreditCategory;
        const isCore = ['DSC', 'PRJ', 'SEC'].includes(cat);
        const groupId = sub.electiveGroupId;

        if (!isCore && groupId && groupBaseCodes.has(groupId)) {
          const base = groupBaseCodes.get(groupId)!;
          const nextOption = (groupCounters.get(groupId) || 0) + 1;
          groupCounters.set(groupId, nextOption);
          
          batch.update(doc(db, 'schemes', schemeId, 'syllabi', sub.id), {
            subjectCode: `${base}.${nextOption}`,
            updatedAt: serverTimestamp()
          });
          continue;
        }

        const pedagogy = sub.type === 'Lab/Sessional' ? 'P' : (cat === 'PRJ' ? 'I' : 'L');
        
        let pillar = 'C';
        if (cat === 'DSE' || cat === 'OFE') pillar = 'E';
        else if (cat === 'SEC') pillar = 'S';
        else if (cat === 'VAC') pillar = 'V';
        else if (cat === 'AEC') pillar = 'A';
        else if (cat === 'MDC') pillar = 'M';
        else if (cat === 'PRJ') pillar = 'P';

        const year = Math.ceil(sub.semester / 2);
        if (!usedSuffixesInScheme.has(year)) usedSuffixesInScheme.set(year, new Set());

        let sequence = 1;
        let baseCode = '';
        const yearSet = usedSuffixesInScheme.get(year)!;

        while (sequence < 100) {
          const seqStr = String(sequence).padStart(2, '0');
          const suffix = `${year}${seqStr}`;
          const candidateBase = `${branchPrefix}${pedagogy}${pillar}${suffix}`;
          
          const conflict = globalUsedCodes.has(candidateBase) || 
                           Array.from(globalUsedCodes).some(c => c.startsWith(candidateBase + '.'));

          if (!yearSet.has(seqStr) && !conflict) {
            baseCode = candidateBase;
            yearSet.add(seqStr);
            break;
          }
          sequence++;
        }

        if (baseCode) {
          let finalCode = baseCode;
          
          if (!isCore && groupId) {
            groupBaseCodes.set(groupId, baseCode);
            groupCounters.set(groupId, 1);
            finalCode = `${baseCode}.1`;
          }

          batch.update(doc(db, 'schemes', schemeId, 'syllabi', sub.id), {
            subjectCode: finalCode,
            updatedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      toast({ title: "Codes Resynced", description: "All local course codes updated." });
    } catch (error: any) {
      toast({ title: "Resync Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsResyncing(false);
    }
  };

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    const docId = data.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', docId);
    
    const finalData = { 
      ...data, 
      id: docId, 
      schemeId, 
      updatedAt: serverTimestamp(),
      isSlot: data.isSlot || false,
      isOFESlot: data.creditCategory === 'OFE' ? (data.isOFESlot || false) : false 
    };

    if (data.creditCategory === 'DSC' || data.creditCategory === 'PRJ' || data.creditCategory === 'SEC') {
      finalData.electiveGroupId = '';
    }
    
    setDoc(docRef, finalData, { merge: true })
      .then(() => toast({ title: "Course Synchronized", description: `${finalData.subjectCode} registered.` }))
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: finalData
        }));
      });
  };

  const handleDeleteSyllabus = (id: string) => {
    const syllabusToDelete = localSyllabi.find(s => s.id === id);
    if (!syllabusToDelete || !permissions.canDeleteSyllabus(syllabusToDelete)) {
      toast({ title: "Permission Denied", description: "Action restricted.", variant: "destructive" });
      return;
    }
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', id);
    deleteDoc(docRef).then(() => {
      toast({ title: "Subject Deleted" });
    }).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete'
      }));
    });
  };

  if (profileLoading || schemeLoading || syllabiLoading || poolLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!scheme) return <div className="p-8 text-center text-muted-foreground">Scheme not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold">{scheme.isCommonPoolScheme ? scheme.branch : (program?.name || 'Academic Layout')}</h1>
            {scheme.isCommonPoolScheme && <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">INSTITUTIONAL POOL</Badge>}
            <Badge variant="outline" className="bg-primary/10 text-primary border-none font-medium">{scheme.version}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            <div className="flex items-center gap.5 font-mono text-primary font-bold"><Hash className="w-3.5 h-3.5" /> {scheme.schemeCode || 'N/A'}</div>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Batch: {scheme.batchYear}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">{scheme.status} {scheme.submissionScope ? `(${scheme.submissionScope})` : ''}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {permissions.isAdmin && (
            <Button variant="outline" onClick={handleResyncCodes} disabled={isResyncing} className="gap-2 border-accent/20 text-accent hover:bg-accent/5">
              {isResyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Resync Codes
            </Button>
          )}
          <Button variant="outline" onClick={() => exportFullSchemeToPDF(scheme, program!, syllabi)}><FileText className="w-4 h-4 mr-2" /> Structure</Button>
          <Button variant="outline" onClick={() => exportCompleteSyllabusToPDF(scheme, program!, syllabi)}><BookOpen className="w-4 h-4 mr-2" /> Syllabus Book</Button>
          {permissions.canEditScheme && (scheme.status === 'Draft' || permissions.isSuperuser) && (
            <Button className="gap-2 shadow-lg" onClick={() => setIsSubmissionDialogOpen(true)}>
              <Send className="w-4 h-4" /> Submit Framework
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-3 space-y-6">
          <Tabs defaultValue="syllabi" className="w-full">
            <TabsList className="bg-white border p-1 h-12 w-full justify-start gap-2">
              <TabsTrigger value="syllabi">Course Structure</TabsTrigger>
              {!scheme.isCommonPoolScheme && <TabsTrigger value="contributions">Pool Contributions</TabsTrigger>}
            </TabsList>
            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {scheme.isCommonPoolScheme && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-emerald-800 text-xs mb-4">
                  <Info className="w-5 h-5 shrink-0" />
                  <p><b>Institutional Repository Mode:</b> Add universal subjects here. These will be automatically injected into departmental schemes based on credit slots and category matches.</p>
                </div>
              )}

              {Array.from({ length: program?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => s.semester === sem && !s.isOFEContribution);
                const groups: Record<string, Syllabus[]> = {};
                const nonGrouped: Syllabus[] = [];
                
                semSyllabi.forEach(s => {
                  if (s.electiveGroupId && !['DSC', 'PRJ', 'SEC'].includes(s.creditCategory)) {
                    groups[s.electiveGroupId] = [...(groups[s.electiveGroupId] || []), s];
                  } else {
                    nonGrouped.push(s);
                  }
                });

                Object.keys(groups).forEach(groupId => {
                  const hasRealMembers = groups[groupId].some(m => !m.isSlot && !m.isOFESlot);
                  if (hasRealMembers) {
                    groups[groupId] = groups[groupId].filter(m => !m.isSlot && !m.isOFESlot);
                  }
                });

                const semTotal = [...Object.values(groups).map(g => g[0].credits || 0), ...nonGrouped.map(s => s.credits || 0)].reduce((a, b) => a + b, 0);

                return (
                  <Card key={sem} className="shadow-sm border-none bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 py-4 px-6">
                      <CardTitle className="text-lg font-headline">Semester {sem}</CardTitle>
                      {permissions.canEditScheme && (
                        <Button size="sm" variant="outline" className="gap-2 h-9 rounded-lg" onClick={() => { setActiveSubject({ semester: sem }); setIsSyllabusDialogOpen(true); }}>
                          <Plus className="w-4 h-4" /> Add Subject
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/10">
                          <TableRow>
                            <TableHead className="w-20 pl-6">Slot</TableHead>
                            <TableHead className="w-24">Code</TableHead>
                            <TableHead>Subject Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">L-T-P</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nonGrouped.map(sub => (
                            <SubjectRow key={sub.id} sub={sub} currentSchemeId={schemeId} schemeStatus={scheme.status} permissions={permissions} onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />
                          ))}
                          {Object.entries(groups).map(([groupId, members]) => (
                            <React.Fragment key={groupId}>
                              <TableRow className="hover:bg-muted/10 cursor-pointer bg-accent/5" onClick={() => setExpandedGroups(p => ({ ...p, [groupId]: !p[groupId] }))}>
                                <TableCell className="pl-6"></TableCell>
                                <TableCell className="font-mono font-bold text-accent">ELECT</TableCell>
                                <TableCell className="font-bold text-accent"><div className="flex items-center gap-2">{expandedGroups[groupId] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {groupId} ({members.length} Options)</div></TableCell>
                                <TableCell><Badge className="bg-accent text-white">{members[0].creditCategory}</Badge></TableCell>
                                <TableCell className="text-center font-mono text-xs">{members[0].lectureCredits}-{members[0].tutorialCredits}-{members[0].practicalCredits}</TableCell>
                                <TableCell className="text-right font-bold text-sm">{members[0].credits}</TableCell>
                                <TableCell className="text-right pr-6">{permissions.canEditScheme && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActiveSubject({ semester: sem, electiveGroupId: groupId, creditCategory: members[0].creditCategory, type: members[0].type, credits: members[0].credits, lectureCredits: members[0].lectureCredits, tutorialCredits: members[0].tutorialCredits, practicalCredits: members[0].practicalCredits }); setIsSyllabusDialogOpen(true); }}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>}</TableCell>
                              </TableRow>
                              {expandedGroups[groupId] && members.map(sub => <SubjectRow key={sub.id} sub={sub} currentSchemeId={schemeId} schemeStatus={scheme.status} permissions={permissions} isOption onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />)}
                            </React.Fragment>
                          ))}
                          {semSyllabi.length === 0 && (
                             <TableRow>
                               <TableCell colSpan={7} className="text-center py-8 text-muted-foreground italic">No patterns defined for this semester.</TableCell>
                             </TableRow>
                          )}
                        </TableBody>
                        {!scheme.isCommonPoolScheme && (
                          <TableFooter className="bg-muted/5">
                            <TableRow>
                              <TableCell colSpan={5} className="pl-6 text-right font-bold text-xs">Total Semester Credits</TableCell>
                              <TableCell className="text-right font-bold text-primary text-base">{semTotal}</TableCell>
                              <TableCell className="pr-6"></TableCell>
                            </TableRow>
                          </TableFooter>
                        )}
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
            {!scheme.isCommonPoolScheme && (
              <TabsContent value="contributions" className="mt-6">
                <Card><CardHeader><CardTitle className="text-lg">Offered to University Pool</CardTitle></CardHeader><CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="pl-6">Code</TableHead><TableHead>Title</TableHead><TableHead>Sem</TableHead><TableHead className="text-center">L-T-P</TableHead><TableHead className="text-right pr-6">Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {syllabi.filter(s => s.isOFEContribution).map(sub => (
                        <TableRow key={sub.id}><TableCell className="pl-6 font-mono font-bold text-primary">{sub.subjectCode}</TableCell><TableCell className="font-medium">{sub.title}</TableCell><TableCell>{sub.semester}</TableCell><TableCell className="text-center font-mono text-xs">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell><TableCell className="text-right pr-6"><Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}><Edit3 className="w-3.5 h-3.5" /></Button></TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent></Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
        {!scheme.isCommonPoolScheme && (
          <div className="space-y-6"><CreditValidator currentCredits={creditDistribution} rules={program?.rules} /></div>
        )}
      </div>

      <Dialog open={isSubmissionDialogOpen} onOpenChange={setIsSubmissionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Academic Submission Policy</DialogTitle>
            <DialogDescription>
              Select the scope of your current submission. If the full 4-year scheme is not ready, you may submit yearly frameworks for immediate implementation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-muted-foreground">Phased Implementation Scope</label>
              <Select value={selectedScope} onValueChange={(v: SubmissionScope) => setSelectedScope(v)}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Year 1">First Year Finalization (Sems 1-2)</SelectItem>
                  <SelectItem value="Year 2">Up to Second Year (Sems 1-4)</SelectItem>
                  <SelectItem value="Year 3">Up to Third Year (Sems 1-6)</SelectItem>
                  <SelectItem value="Complete">Complete Degree Structure (Sems 1-8)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isSchemeValid && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3 text-[11px] text-amber-800 leading-tight">
                <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Your current structure does not meet the requirements for <b>{selectedScope}</b>. Ensure all relevant semesters have finalized subjects and proper credit counts.</p>
              </div>
            )}
            {isSchemeValid && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex gap-3 text-[11px] text-emerald-800 leading-tight">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Curriculum structure validated for <b>{selectedScope}</b>. Proceeding to {profile?.role === 'dean_faculty' ? 'Dean approval' : 'university-wide review'}.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubmissionDialogOpen(false)}>Cancel</Button>
            <Button disabled={!isSchemeValid} onClick={handleSubmitScheme} className="gap-2">
              <Send className="w-4 h-4" /> Finalize & Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SyllabusDialog 
        open={isSyllabusDialogOpen} 
        onOpenChange={setIsSyllabusDialogOpen} 
        syllabus={activeSubject}
        existingSyllabi={syllabi}
        onSave={handleSaveSyllabus}
        programName={scheme.isCommonPoolScheme ? scheme.branch : program?.name}
        branchPrefix={branchPrefix}
        canEdit={permissions.canEditSyllabus(activeSubject)}
        canDelete={permissions.canDeleteSyllabus(activeSubject)}
        currentSchemeId={schemeId}
        programRules={program?.rules}
        batchYear={scheme?.batchYear}
        userProfile={profile || undefined}
      />
    </div>
  );
}

function SubjectRow({ sub, currentSchemeId, schemeStatus, permissions, isOption, onEdit, onDelete }: any) {
  const canEdit = permissions.canEditSyllabus(sub);
  const canDelete = permissions.canDeleteSyllabus(sub);
  const isSlot = sub.isSlot || sub.isOFESlot;
  const isFromPool = sub.schemeId !== currentSchemeId;

  const displayTitle = (sub.title === 'Slot Placeholder' || sub.title === 'Institutional Pool Slot') 
    ? sub.creditCategory 
    : sub.title;

  return (
    <TableRow className={`group transition-colors ${isOption ? 'bg-muted/30' : ''} ${isFromPool ? 'bg-emerald-50/20' : ''}`}>
      <TableCell className="pl-6">
        {sub.timetableSlot ? (
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold font-mono text-[10px]">
            {sub.timetableSlot}
          </Badge>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">-</span>
        )}
      </TableCell>
      <TableCell className={`font-mono text-xs font-bold ${isSlot ? 'text-blue-600' : isFromPool ? 'text-emerald-700' : 'text-primary'}`}>{(isSlot && !sub.subjectCode) ? 'SLOT' : sub.subjectCode}</TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="flex items-center gap-2">
            {isSlot && <Globe className="w-3 h-3 text-blue-500" />} 
            {isFromPool && <Layers className="w-3 h-3 text-emerald-500" />} 
            {displayTitle} 
            {isFromPool && <Badge variant="outline" className="text-[8px] bg-emerald-600 text-white border-none font-black tracking-tighter px-1.5 py-0.5 uppercase">Institutional</Badge>}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase">{sub.type}</span>
        </div>
      </TableCell>
      <TableCell><Badge variant="secondary" className="text-[9px] font-bold">{sub.creditCategory}</Badge></TableCell>
      <TableCell className="text-center font-mono text-xs text-muted-foreground">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell>
      <TableCell className="text-right font-bold text-sm">{sub.credits}</TableCell>
      <TableCell className="text-right pr-6">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isSlot && <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => exportSyllabusToPDF(sub, 'Program', 'Branch', 'Year', schemeStatus)}><FileDown className="w-3.5 h-3.5" /></Button>}
          {(canEdit || permissions.isMonitor) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onEdit}>{canEdit ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Button>}
          {canDelete && !isFromPool && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>}
        </div>
      </TableCell>
    </TableRow>
  );
}
