
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, deleteDoc, serverTimestamp, updateDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Plus, Send, Trash2, Edit3, Loader2, FileText, Hash, FileDown, ChevronRight, ChevronDown, Globe, BookOpen, Layers, Info, RefreshCw } from "lucide-react";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, Program, UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { exportSyllabusToPDF, exportFullSchemeToPDF } from "@/lib/pdf-export";

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

  const programRef = useMemoFirebase(() => (scheme?.programId ? doc(db, 'programs', scheme.programId) : null), [db, scheme?.programId]);
  const { data: program } = useDoc<Program>(programRef);

  const [poolSyllabi, setPoolSyllabi] = useState<Syllabus[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (!scheme || scheme.isCommonPoolScheme) return;

    const fetchPool = async () => {
      setPoolLoading(true);
      try {
        const poolQuery = query(
          collection(db, 'schemes'),
          where('programId', '==', scheme.programId),
          where('batchYear', '==', scheme.batchYear),
          where('isCommonPoolScheme', '==', true)
        );
        const poolSnap = await getDocs(poolQuery);
        const poolScheme = poolSnap.docs[0];

        if (poolScheme) {
          const poolSyllabiSnap = await getDocs(collection(db, 'schemes', poolScheme.id, 'syllabi'));
          setPoolSyllabi(poolSyllabiSnap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
        }
      } catch (err) {
        console.error("Failed to fetch common pool:", err);
      } finally {
        setPoolLoading(false);
      }
    };

    fetchPool();
  }, [db, scheme]);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const syllabi = useMemo(() => {
    const uniqueMap = new Map<string, Syllabus>();
    const all = [...localSyllabi, ...poolSyllabi];
    
    all.forEach(s => {
      const key = (s.isSlot || s.isOFESlot) ? s.id : (s.subjectCode || s.id);
      if (!uniqueMap.has(key) || s.schemeId === schemeId) {
        uniqueMap.set(key, s);
      }
    });
    return Array.from(uniqueMap.values()).sort((a, b) => (a.semester || 1) - (b.semester || 1));
  }, [localSyllabi, poolSyllabi, schemeId]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const permissions = useMemo(() => {
    if (profileLoading || !profile || !scheme || !program) return { canEditScheme: false, canDelete: false, canEditSyllabus: (s: Partial<Syllabus> | undefined) => false };

    const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile.role);
    const isProgramDean = profile.role === 'dean_faculty' && profile.faculty === program.faculty;
    const isCommonBOS = profile.faculty === 'University-wide (Common BOS)';
    const isBoS = ['bos_convenor', 'bos_member'].includes(profile.role);

    let canEditScheme = false;
    if (isGlobalAdmin || isProgramDean) {
      canEditScheme = true;
    } else if (scheme.isCommonPoolScheme) {
      canEditScheme = isCommonBOS;
    } else {
      canEditScheme = profile.managedBranches?.some(
        m => m.programId === scheme.programId && m.branch === scheme.branch
      ) || false;
    }

    const canDelete = !isBoS && (isGlobalAdmin || isProgramDean || (scheme.isCommonPoolScheme && isCommonBOS));

    const canEditSyllabus = (s: Partial<Syllabus> | undefined) => {
      if (isGlobalAdmin) return true;
      if (!s) return false;
      const isInstitutionalCategory = s.creditCategory ? ['VAC', 'AEC', 'MDC', 'SEC', 'OFE'].includes(s.creditCategory) : false;
      if (isCommonBOS && isInstitutionalCategory) return true;
      if (s?.schemeId && s.schemeId !== schemeId) return false;
      return canEditScheme;
    };

    return { canEditScheme, canDelete, canEditSyllabus };
  }, [profile, profileLoading, scheme, program, schemeId]);

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, CPF: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, PRJ: 0, total: 0 };
    const countedGroups = new Set<string>();

    syllabi.forEach(sub => {
      const cat = sub.creditCategory as keyof typeof dist;
      if (sub.isOFEContribution) return;

      if (sub.electiveGroupId) {
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
    if (!program?.rules) return false;
    const { total } = creditDistribution;
    return total === program.rules.totalRequired;
  }, [creditDistribution, program?.rules]);

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    if (!permissions.canEditScheme) return;
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    const code = (data.isSlot || data.isOFESlot) ? data.id : data.subjectCode;
    if (!code) return;

    const docRef = doc(db, 'schemes', schemeId, 'syllabi', code);
    const finalData = { 
      ...data, 
      id: code, 
      schemeId, 
      updatedAt: serverTimestamp(),
      isSlot: false,
      isOFESlot: data.creditCategory === 'OFE' ? (data.isOFESlot || false) : false 
    };
    
    setDoc(docRef, finalData, { merge: true })
      .then(() => toast({ title: "Course Synchronized", description: `${code} registered.` }))
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: finalData
        }));
      });
  };

  const handleDeleteSyllabus = (id: string) => {
    if (!permissions.canDelete) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', id);
    deleteDoc(docRef);
  };

  const handleBulkSyncPool = async () => {
    if (!scheme || scheme.isCommonPoolScheme || !permissions.canEditScheme) return;
    
    setIsSyncing(true);
    try {
      const bYear = scheme.batchYear.trim();
      const poolQuery = query(
        collection(db, 'schemes'),
        where('batchYear', '==', bYear),
        where('isCommonPoolScheme', '==', true)
      );
      
      const poolSnap = await getDocs(poolQuery);
      if (poolSnap.empty) {
        toast({ title: "Pool Not Found", description: `No Common Pool defined for batch "${bYear}".`, variant: "destructive" });
        return;
      }
      
      const poolSchemeId = poolSnap.docs[0].id;
      const poolSyllabiSnap = await getDocs(collection(db, 'schemes', poolSchemeId, 'syllabi'));
      const poolCourses = poolSyllabiSnap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus));

      const batch = writeBatch(db);
      let syncCount = 0;

      for (const localSub of localSyllabi) {
        const isInst = ['VAC', 'AEC', 'MDC', 'SEC', 'OFE'].includes(localSub.creditCategory);
        if (!isInst) continue;

        let match: Syllabus | undefined;
        if (localSub.subjectCode) {
          match = poolCourses.find(p => p.subjectCode === localSub.subjectCode);
        }
        
        if (!match && (localSub.isSlot || localSub.isOFESlot)) {
           const categoryCourses = poolCourses.filter(p => p.creditCategory === localSub.creditCategory && !p.isSlot);
           match = categoryCourses.find(p => p.semester === localSub.semester) || categoryCourses[0];
        }

        if (match) {
          const docRef = doc(db, 'schemes', schemeId, 'syllabi', localSub.id);
          const cleanMatch = JSON.parse(JSON.stringify(match));
          
          const updateData = {
            ...cleanMatch,
            id: localSub.id,
            schemeId: schemeId,
            semester: localSub.semester,
            isSlot: false,
            isOFESlot: false,
            updatedAt: serverTimestamp()
          };
          
          batch.set(docRef, updateData, { merge: true });
          syncCount++;
        }
      }

      if (syncCount > 0) {
        await batch.commit();
        toast({ title: "Sync Complete", description: `Successfully synchronized ${syncCount} courses from the pool.` });
      } else {
        toast({ title: "No Matching Courses", description: "No approved courses found in pool for your slots." });
      }

    } catch (err: any) {
      console.error("Bulk sync failed:", err);
      toast({ title: "Sync Failed", description: err.message || "Failed to synchronize.", variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
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
            <h1 className="text-3xl font-headline font-bold">{program?.name || 'Academic Layout'}</h1>
            {scheme.isCommonPoolScheme && <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold">INSTITUTIONAL</Badge>}
            <Badge variant="outline" className="bg-primary/10 text-primary border-none font-medium">{scheme.version}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            <div className="flex items-center gap-1.5 font-mono text-primary font-bold"><Hash className="w-3.5 h-3.5" /> {scheme.schemeCode || 'N/A'}</div>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Branch: <span className="font-bold text-foreground">{scheme.branch || 'General'}</span></span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Batch: {scheme.batchYear}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">{scheme.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!scheme.isCommonPoolScheme && permissions.canEditScheme && (
            <Button variant="outline" className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={handleBulkSyncPool} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Institutional Pool
            </Button>
          )}
          <Button variant="outline" className="gap-2 border-primary/20 text-primary" onClick={() => exportFullSchemeToPDF(scheme, program!, syllabi)}>
            <FileText className="w-4 h-4" /> Download Structure
          </Button>
          {permissions.canEditScheme && scheme.status === 'Draft' && (
            <Button className="gap-2 shadow-lg" disabled={!isSchemeValid} onClick={() => handleUpdateScheme({ status: 'Pending Dean' })}>
              <Send className="w-4 h-4" /> Submit for Approval
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-3 space-y-6">
          <Tabs defaultValue="syllabi" className="w-full">
            <TabsList className="bg-white border p-1 h-12 w-full justify-start gap-2">
              <TabsTrigger value="syllabi" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Course Structure</TabsTrigger>
              <TabsTrigger value="contributions" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Pool Contributions</TabsTrigger>
            </TabsList>

            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {!scheme.isCommonPoolScheme && poolSyllabi.length > 0 && (
                <Card className="bg-emerald-50 border-emerald-100 border-dashed">
                  <CardContent className="p-4 flex items-center gap-3 text-xs text-emerald-800">
                    <Layers className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div className="flex-1">
                      <span className="font-bold">Common Pool Active:</span> {poolSyllabi.length} institutional courses are currently synchronized from the University BOS.
                    </div>
                  </CardContent>
                </Card>
              )}

              {Array.from({ length: program?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => s.semester === sem && !s.isOFEContribution);
                const groups: Record<string, Syllabus[]> = {};
                const nonGrouped: Syllabus[] = [];

                semSyllabi.forEach(s => {
                  if (s.electiveGroupId) {
                    if (!groups[s.electiveGroupId]) groups[s.electiveGroupId] = [];
                    groups[s.electiveGroupId].push(s);
                  } else {
                    nonGrouped.push(s);
                  }
                });

                const semTotal = [
                  ...Object.values(groups).map(g => g[0].credits || 0),
                  ...nonGrouped.map(s => s.credits || 0)
                ].reduce((a, b) => a + b, 0);

                const semL = [
                  ...Object.values(groups).map(g => g[0].lectureCredits || 0),
                  ...nonGrouped.map(s => s.lectureCredits || 0)
                ].reduce((a, b) => a + b, 0);

                const semT = [
                  ...Object.values(groups).map(g => g[0].tutorialCredits || 0),
                  ...nonGrouped.map(s => s.tutorialCredits || 0)
                ].reduce((a, b) => a + b, 0);

                const semP = [
                  ...Object.values(groups).map(g => g[0].practicalCredits || 0),
                  ...nonGrouped.map(s => s.practicalCredits || 0)
                ].reduce((a, b) => a + b, 0);

                return (
                  <Card key={sem} className="shadow-sm border-none bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 py-4 px-6">
                      <div className="space-y-0.5">
                        <CardTitle className="text-lg font-headline">Semester {sem}</CardTitle>
                      </div>
                      {permissions.canEditScheme && (
                        <Button size="sm" variant="outline" className="gap-2 h-9 rounded-lg" onClick={() => { setActiveSubject({ semester: sem }); setIsSyllabusDialogOpen(true); }}>
                          <Plus className="w-4 h-4" /> Add Subject
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/10">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-24 pl-6">Code</TableHead>
                            <TableHead>Subject Title / Slot</TableHead>
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
                          {Object.entries(groups).map(([groupId, members]) => {
                            const isExpanded = expandedGroups[groupId];
                            const isOfePool = members.some(m => m.creditCategory === 'OFE' && m.isOFESlot);
                            return (
                              <React.Fragment key={groupId}>
                                <TableRow className={`hover:bg-muted/10 cursor-pointer ${isOfePool ? 'bg-blue-50/30' : 'bg-accent/5'}`} onClick={() => toggleGroup(groupId)}>
                                  <TableCell className="pl-6 font-mono font-bold text-accent">{isOfePool ? 'POOL' : 'DSE'}</TableCell>
                                  <TableCell className="font-bold">
                                    <div className={`flex items-center gap-2 ${isOfePool ? 'text-blue-600' : 'text-accent'}`}>
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                      {groupId} {isOfePool ? '(Institutional Pool)' : `(${members.length} Branch Options)`}
                                    </div>
                                  </TableCell>
                                  <TableCell><Badge className={`${isOfePool ? 'bg-blue-500' : 'bg-accent'} text-white border-none text-[9px]`}>{members[0].creditCategory}</Badge></TableCell>
                                  <TableCell className="text-center font-mono text-xs">{members[0].lectureCredits}-{members[0].tutorialCredits}-{members[0].practicalCredits}</TableCell>
                                  <TableCell className="text-right font-bold text-sm">{members[0].credits}</TableCell>
                                  <TableCell className="text-right pr-6">
                                    {permissions.canEditScheme && !isOfePool && (
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActiveSubject({ semester: sem, electiveGroupId: groupId, creditCategory: members[0].creditCategory }); setIsSyllabusDialogOpen(true); }}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Option
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                                {isExpanded && !isOfePool && members.map(sub => (
                                  <SubjectRow key={sub.id} sub={sub} currentSchemeId={schemeId} schemeStatus={scheme.status} permissions={permissions} isOption onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />
                                ))}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                        <TableFooter className="bg-muted/5">
                          <TableRow>
                            <TableCell colSpan={3} className="pl-6 text-right font-bold text-xs uppercase tracking-wider text-muted-foreground">Total Semester Credits</TableCell>
                            <TableCell className="text-center font-mono font-bold text-xs">{semL}-{semT}-{semP}</TableCell>
                            <TableCell className="text-right font-bold text-primary text-base">{semTotal}</TableCell>
                            <TableCell className="pr-6"></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            <TabsContent value="contributions" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Offered to University Pool</CardTitle>
                  <CardDescription>Courses from this branch available as Open Electives for other departments.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Sem</TableHead>
                        <TableHead className="text-center">L-T-P</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {syllabi.filter(s => s.isOFEContribution).map(sub => (
                        <TableRow key={sub.id}>
                          <TableCell className="pl-6 font-mono font-bold text-primary">{sub.subjectCode}</TableCell>
                          <TableCell className="font-medium">{sub.title}</TableCell>
                          <TableCell>{sub.semester}</TableCell>
                          <TableCell className="text-center font-mono text-xs">{sub.lectureCredits || 0}-{sub.tutorialCredits || 0}-{sub.practicalCredits || 0}</TableCell>
                          <TableCell className="text-right pr-6">
                             <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                  <Edit3 className="w-3.5 h-3.5" />
                                </Button>
                                {permissions.canDelete && (
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => handleDeleteSyllabus(sub.id)}>
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
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          <CreditValidator currentCredits={creditDistribution} rules={program?.rules} />
        </div>
      </div>

      <SyllabusDialog 
        open={isSyllabusDialogOpen} 
        onOpenChange={setIsSyllabusDialogOpen} 
        syllabus={activeSubject}
        existingSyllabi={syllabi}
        onSave={handleSaveSyllabus}
        programName={program?.name}
        branchName={scheme?.branch}
        canEdit={permissions.canEditSyllabus(activeSubject)}
        canDelete={permissions.canDelete}
        currentSchemeId={schemeId}
        programRules={program?.rules}
        batchYear={scheme?.batchYear}
      />
    </div>
  );
}

function SubjectRow({ sub, currentSchemeId, schemeStatus, permissions, isOption, onEdit, onDelete }: any) {
  const canEdit = permissions.canEditSyllabus(sub);
  const isSlot = sub.isSlot || sub.isOFESlot;
  const isFromPool = sub.schemeId !== currentSchemeId;
  
  return (
    <TableRow className={`group transition-colors ${isOption ? 'bg-muted/30' : ''} ${isFromPool ? 'bg-emerald-50/20' : ''}`}>
      <TableCell className={`font-mono text-xs font-bold ${isSlot ? 'text-blue-600' : isFromPool ? 'text-emerald-700' : 'text-primary'} ${isOption ? 'pl-10' : 'pl-6'}`}>
        {(isSlot && !sub.subjectCode) ? 'SLOT' : sub.subjectCode}
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span className="flex items-center gap-2">
            {isSlot && <Globe className="w-3 h-3 text-blue-500" />}
            {isFromPool && <Layers className="w-3 h-3 text-emerald-500" />}
            {sub.title}
            {isFromPool && <Badge variant="outline" className="text-[8px] bg-white border-emerald-200 text-emerald-600 font-bold ml-2">POOL</Badge>}
          </span>
          <span className="text-[10px] text-muted-foreground uppercase">{isSlot ? 'Institutional Pool Slot' : sub.type}</span>
        </div>
      </TableCell>
      <TableCell><Badge variant="secondary" className="text-[9px] font-bold">{sub.creditCategory}</Badge></TableCell>
      <TableCell className="text-center font-mono text-xs text-muted-foreground">
        {sub.lectureCredits || 0}-{sub.tutorialCredits || 0}-{sub.practicalCredits || 0}
      </TableCell>
      <TableCell className="text-right font-bold text-sm">{sub.credits}</TableCell>
      <TableCell className="text-right pr-6">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isSlot && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => exportSyllabusToPDF(sub, 'Program', 'Branch', 'Year', schemeStatus)}>
              <FileDown className="w-3.5 h-3.5" />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onEdit}>
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
          )}
          {permissions.canDelete && !isFromPool && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
          {isFromPool && (
            <div className="flex items-center px-2 text-[10px] text-muted-foreground italic">
              View Only
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
