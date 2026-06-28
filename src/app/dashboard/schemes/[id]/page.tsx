
"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, deleteDoc, serverTimestamp, updateDoc, query, where, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Plus, Send, Trash2, Edit3, Loader2, FileText, Hash, FileDown, ChevronRight, ChevronDown, Globe, Layers, BookOpen, Eye } from "lucide-react";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, Program, UserProfile } from "@/lib/types";
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

  const programRef = useMemoFirebase(() => (scheme?.programId ? doc(db, 'programs', scheme.programId) : null), [db, scheme?.programId]);
  const { data: program } = useDoc<Program>(programRef);

  const [poolSyllabi, setPoolSyllabi] = useState<Syllabus[]>([]);
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    if (!scheme) return;

    const fetchPool = async () => {
      setPoolLoading(true);
      try {
        const poolQuery = query(
          collection(db, 'schemes'),
          where('batchYear', '==', scheme.batchYear),
          where('isCommonPoolScheme', '==', true)
        );
        const poolSnap = await getDocs(poolQuery);
        
        let allPoolSyllabi: Syllabus[] = [];
        for (const poolDoc of poolSnap.docs) {
          if (poolDoc.id === schemeId) continue;
          const poolSyllabiSnap = await getDocs(collection(db, 'schemes', poolDoc.id, 'syllabi'));
          const batchSyllabi = poolSyllabiSnap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus));
          allPoolSyllabi = [...allPoolSyllabi, ...batchSyllabi];
        }
        setPoolSyllabi(allPoolSyllabi);
      } catch (err) {
        console.error("Institutional pool sync failed:", err);
      } finally {
        setPoolLoading(false);
      }
    };

    fetchPool();
  }, [db, scheme, schemeId]);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const syllabi = useMemo(() => {
    const uniqueMap = new Map<string, Syllabus>();
    const all = [...localSyllabi, ...poolSyllabi];
    
    all.forEach(s => {
      const key = (s.isSlot || s.isOFESlot) ? s.id : (s.subjectCode || s.id);
      const existing = uniqueMap.get(key);
      const isNewCourseOnSlot = existing && (existing.isSlot || existing.isOFESlot) && !(s.isSlot || s.isOFESlot);
      
      if (!existing || s.schemeId === schemeId || isNewCourseOnSlot) {
        uniqueMap.set(key, s);
      }
    });

    const finalById = new Map<string, Syllabus>();
    Array.from(uniqueMap.values()).forEach(s => {
      if (!finalById.has(s.id) || s.schemeId === schemeId) {
        finalById.set(s.id, s);
      }
    });

    return Array.from(finalById.values()).sort((a, b) => {
      if ((a.semester || 1) !== (b.semester || 1)) {
        return (a.semester || 1) - (b.semester || 1);
      }
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
  }, [localSyllabi, poolSyllabi, schemeId]);

  const permissions = useMemo(() => {
    if (profileLoading || !profile || !scheme || !program) return { 
      canEditScheme: false, 
      canDeleteSyllabus: (s: any) => false, 
      canEditSyllabus: (s: any) => false 
    };

    if (profile.role === 'monitor') {
      return { canEditScheme: false, canDeleteSyllabus: () => false, canEditSyllabus: () => false };
    }

    const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile.role);
    const isProgramDean = profile.role === 'dean_faculty' && profile.faculty === program.faculty;
    const isCommonBOS = profile.faculty === 'University-wide (Common BOS)';
    const myBranchRole = profile.managedBranches?.find(m => m.programId === scheme.programId && m.branch === scheme.branch)?.role;

    let canEditScheme = false;
    if (isGlobalAdmin || isProgramDean) {
      canEditScheme = true;
    } else if (scheme.isCommonPoolScheme) {
      canEditScheme = isCommonBOS;
    } else {
      canEditScheme = myBranchRole === 'bos_convenor';
    }

    const canEditSyllabus = (s: any) => {
      // AEC, VAC, MDC are restricted to Admin, Dean Academic, and Common BOS
      const isInstitutionalCategory = ['AEC', 'VAC', 'MDC'].includes(s?.creditCategory);
      const hasCentralAuth = isGlobalAdmin || isCommonBOS;
      
      if (isInstitutionalCategory) {
        return hasCentralAuth;
      }
      
      // Standard categories allow modification by scheme owners or branch managers
      return isGlobalAdmin || isProgramDean || !!myBranchRole || canEditScheme;
    };

    const canDeleteSyllabus = (s: any) => canEditSyllabus(s);

    return { canEditScheme, canDeleteSyllabus, canEditSyllabus };
  }, [profile, profileLoading, scheme, program]);

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, PRJ: 0, total: 0 };
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
    return creditDistribution.total === program.rules.totalRequired;
  }, [creditDistribution, program?.rules]);

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    if (!permissions.canEditScheme) return;
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    const docId = data.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', docId);
    
    const finalData = { 
      ...data, 
      id: docId, 
      schemeId, 
      updatedAt: serverTimestamp(),
      isSlot: false,
      isOFESlot: data.creditCategory === 'OFE' ? (data.isOFESlot || false) : false 
    };
    
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
    if (!syllabusToDelete || !permissions.canDeleteSyllabus(syllabusToDelete)) return;
    
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', id);
    deleteDoc(docRef);
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
            {profile?.role === 'monitor' && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Monitoring View</Badge>
            )}
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
          <Button variant="outline" onClick={() => exportFullSchemeToPDF(scheme, program!, syllabi)}><FileText className="w-4 h-4 mr-2" /> Structure</Button>
          <Button variant="outline" onClick={() => exportCompleteSyllabusToPDF(scheme, program!, syllabi)}><BookOpen className="w-4 h-4 mr-2" /> Syllabus Book</Button>
          {permissions.canEditScheme && scheme.status === 'Draft' && (
            <Button className="gap-2 shadow-lg" disabled={!isSchemeValid} onClick={() => handleUpdateScheme({ status: 'Pending Dean' })}>
              <Send className="w-4 h-4" /> Submit
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-3 space-y-6">
          <Tabs defaultValue="syllabi" className="w-full">
            <TabsList className="bg-white border p-1 h-12 w-full justify-start gap-2">
              <TabsTrigger value="syllabi">Course Structure</TabsTrigger>
              <TabsTrigger value="contributions">Pool Contributions</TabsTrigger>
            </TabsList>
            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {Array.from({ length: program?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => s.semester === sem && !s.isOFEContribution);
                const groups: Record<string, Syllabus[]> = {};
                const nonGrouped: Syllabus[] = [];
                semSyllabi.forEach(s => s.electiveGroupId ? (groups[s.electiveGroupId] = [...(groups[s.electiveGroupId] || []), s]) : nonGrouped.push(s));

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
                        <TableHeader className="bg-muted/10"><TableRow><TableHead className="w-24 pl-6">Code</TableHead><TableHead>Subject Title / Slot</TableHead><TableHead>Category</TableHead><TableHead className="text-center">L-T-P</TableHead><TableHead className="text-right">Credits</TableHead><TableHead className="text-right pr-6">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {nonGrouped.map(sub => (
                            <SubjectRow key={sub.id} sub={sub} currentSchemeId={schemeId} schemeStatus={scheme.status} permissions={permissions} onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />
                          ))}
                          {Object.entries(groups).map(([groupId, members]) => (
                            <React.Fragment key={groupId}>
                              <TableRow className="hover:bg-muted/10 cursor-pointer bg-accent/5" onClick={() => setExpandedGroups(p => ({ ...p, [groupId]: !p[groupId] }))}>
                                <TableCell className="pl-6 font-mono font-bold text-accent">DSE</TableCell>
                                <TableCell className="font-bold text-accent"><div className="flex items-center gap-2">{expandedGroups[groupId] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {groupId} ({members.length} Options)</div></TableCell>
                                <TableCell><Badge className="bg-accent text-white">{members[0].creditCategory}</Badge></TableCell>
                                <TableCell className="text-center font-mono text-xs">{members[0].lectureCredits}-{members[0].tutorialCredits}-{members[0].practicalCredits}</TableCell>
                                <TableCell className="text-right font-bold text-sm">{members[0].credits}</TableCell>
                                <TableCell className="text-right pr-6">{permissions.canEditScheme && <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActiveSubject({ semester: sem, electiveGroupId: groupId, creditCategory: members[0].creditCategory }); setIsSyllabusDialogOpen(true); }}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>}</TableCell>
                              </TableRow>
                              {expandedGroups[groupId] && members.map(sub => <SubjectRow key={sub.id} sub={sub} currentSchemeId={schemeId} schemeStatus={scheme.status} permissions={permissions} isOption onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />)}
                            </React.Fragment>
                          ))}
                        </TableBody>
                        <TableFooter className="bg-muted/5"><TableRow><TableCell colSpan={4} className="pl-6 text-right font-bold text-xs">Total Semester Credits</TableCell><TableCell className="text-right font-bold text-primary text-base">{semTotal}</TableCell><TableCell className="pr-6"></TableCell></TableRow></TableFooter>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
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
          </Tabs>
        </div>
        <div className="space-y-6"><CreditValidator currentCredits={creditDistribution} rules={program?.rules} /></div>
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
  return (
    <TableRow className={`group transition-colors ${isOption ? 'bg-muted/30' : ''} ${isFromPool ? 'bg-emerald-50/20' : ''}`}>
      <TableCell className={`font-mono text-xs font-bold ${isSlot ? 'text-blue-600' : isFromPool ? 'text-emerald-700' : 'text-primary'} ${isOption ? 'pl-10' : 'pl-6'}`}>{(isSlot && !sub.subjectCode) ? 'SLOT' : sub.subjectCode}</TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col"><span className="flex items-center gap-2">{isSlot && <Globe className="w-3 h-3 text-blue-500" />} {isFromPool && <Layers className="w-3 h-3 text-emerald-500" />} {sub.title} {isFromPool && <Badge variant="outline" className="text-[8px] bg-white border-emerald-200 text-emerald-600">POOL</Badge>}</span><span className="text-[10px] text-muted-foreground uppercase">{isSlot ? 'Institutional Pool Slot' : sub.type}</span></div>
      </TableCell>
      <TableCell><Badge variant="secondary" className="text-[9px] font-bold">{sub.creditCategory}</Badge></TableCell>
      <TableCell className="text-center font-mono text-xs text-muted-foreground">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell>
      <TableCell className="text-right font-bold text-sm">{sub.credits}</TableCell>
      <TableCell className="text-right pr-6"><div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isSlot && <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => exportSyllabusToPDF(sub, 'Program', 'Branch', 'Year', schemeStatus)}><FileDown className="w-3.5 h-3.5" /></Button>}
        {(canEdit || permissions.isMonitor) && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onEdit}>{canEdit ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}</Button>}
        {canDelete && !isFromPool && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>}
      </div></TableCell>
    </TableRow>
  );
}
