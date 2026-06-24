"use client";

import React, { useState, useMemo } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, deleteDoc, serverTimestamp, updateDoc, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Send, Trash2, Edit3, Loader2, FileText, Hash, FileDown, ChevronRight, ChevronDown } from "lucide-react";
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
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const schemeRef = useMemoFirebase(() => doc(db, 'schemes', schemeId), [db, schemeId]);
  const { data: scheme, loading: schemeLoading } = useDoc<Scheme>(schemeRef);

  const syllabiRef = useMemoFirebase(() => collection(db, 'schemes', schemeId, 'syllabi'), [db, schemeId]);
  const { data: localSyllabi, loading: syllabiLoading } = useCollection<Syllabus>(syllabiRef);

  const programRef = useMemoFirebase(() => (scheme?.programId ? doc(db, 'programs', scheme.programId) : null), [db, scheme?.programId]);
  const { data: program } = useDoc<Program>(programRef);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const syllabi = useMemo(() => {
    // Ensure uniqueness across local syllabi to avoid React key errors
    const uniqueMap = new Map<string, Syllabus>();
    localSyllabi.forEach(s => {
      uniqueMap.set(s.subjectCode, s);
    });
    return Array.from(uniqueMap.values()).sort((a, b) => (a.semester || 1) - (b.semester || 1));
  }, [localSyllabi]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const permissions = useMemo(() => {
    if (!profile || !scheme || !program) return { canEditScheme: false, canEditSyllabus: (s: Syllabus) => false };

    const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile.role);
    const isProgramDean = profile.role === 'dean_faculty' && profile.faculty === program.faculty;
    const isCommonBOS = profile.faculty === 'University-wide (Common BOS)';

    let canEditScheme = false;
    if (isGlobalAdmin || isProgramDean) {
      canEditScheme = true;
    } else if (scheme.isCommonPoolScheme && isCommonBOS) {
      canEditScheme = true;
    } else if (!scheme.isCommonPoolScheme) {
      canEditScheme = profile.managedBranches?.some(
        m => m.programId === scheme.programId && m.branch === scheme.branch
      ) || false;
    }

    const canEditSyllabus = (s: Syllabus) => {
      if (isGlobalAdmin) return true;
      const isCommonCategory = ['VAC', 'AEC', 'MDC'].includes(s?.creditCategory || '');
      if (isCommonCategory || s?.isCommonCourse || scheme.isCommonPoolScheme) {
        return isCommonBOS || isProgramDean;
      }
      return canEditScheme;
    };

    return { canEditScheme, canEditSyllabus };
  }, [profile, scheme, program]);

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, CPF: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, total: 0 };
    const countedGroups = new Set<string>();

    syllabi.forEach(sub => {
      const cat = sub.creditCategory as keyof typeof dist;
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
    const { DSC, total } = creditDistribution;
    const { dscMin, dscMax, totalRequired } = program.rules;
    return DSC >= dscMin && DSC <= dscMax && total === totalRequired;
  }, [creditDistribution, program?.rules]);

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    if (!permissions.canEditScheme) return;
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() });
  };

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    if (!data.subjectCode) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', data.subjectCode);
    const finalData = { ...data, id: data.subjectCode, schemeId, updatedAt: serverTimestamp() };
    
    setDoc(docRef, finalData, { merge: true })
      .then(() => toast({ title: "Course Saved", description: `${data.subjectCode} synchronized.` }))
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: finalData
        }));
      });
  };

  const handleDeleteSyllabus = (id: string) => {
    if (!permissions.canEditScheme) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', id);
    deleteDoc(docRef);
  };

  if (schemeLoading || syllabiLoading) {
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
        <div className="flex items-center gap-3">
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

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-6">
          <Tabs defaultValue="syllabi" className="w-full">
            <TabsList className="bg-white border p-1 h-12 w-full justify-start gap-2">
              <TabsTrigger value="syllabi" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">Course Structure</TabsTrigger>
              <TabsTrigger value="nep" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">NEP 2020 Builder</TabsTrigger>
            </TabsList>

            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {Array.from({ length: program?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => s.semester === sem);
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

                const semTotal = [...Object.values(groups).map(g => g[0].credits || 0), ...nonGrouped.map(s => s.credits || 0)].reduce((a, b) => a + b, 0);

                return (
                  <Card key={sem} className="shadow-sm border-none bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 py-4 px-6">
                      <div className="space-y-0.5">
                        <CardTitle className="text-lg font-headline">Semester {sem}</CardTitle>
                        <CardDescription className="text-xs font-medium">Credits: <span className="text-primary font-bold">{semTotal}</span></CardDescription>
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
                            <TableHead>Subject Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {nonGrouped.map(sub => (
                            <SubjectRow key={sub.subjectCode} sub={sub} permissions={permissions} onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />
                          ))}
                          {Object.entries(groups).map(([groupId, members]) => {
                            const isExpanded = expandedGroups[groupId];
                            return (
                              <React.Fragment key={groupId}>
                                <TableRow className="bg-accent/5 hover:bg-accent/10 cursor-pointer" onClick={() => toggleGroup(groupId)}>
                                  <TableCell className="pl-6 font-mono font-bold text-accent">{groupId}</TableCell>
                                  <TableCell className="font-bold">
                                    <div className="flex items-center gap-2 text-accent">
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                      {groupId} Pool ({members.length} Subjects)
                                    </div>
                                  </TableCell>
                                  <TableCell><Badge className="bg-accent text-white border-none text-[9px]">{members[0].creditCategory}</Badge></TableCell>
                                  <TableCell className="text-right font-bold text-sm">{members[0].credits}</TableCell>
                                  <TableCell className="text-right pr-6">
                                    {permissions.canEditScheme && (
                                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActiveSubject({ semester: sem, electiveGroupId: groupId, creditCategory: members[0].creditCategory }); setIsSyllabusDialogOpen(true); }}>
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Option
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                                {isExpanded && members.map(sub => (
                                  <SubjectRow key={sub.subjectCode} sub={sub} permissions={permissions} isOption onEdit={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }} onDelete={() => handleDeleteSyllabus(sub.id)} />
                                ))}
                              </React.Fragment>
                            );
                          })}
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
        canEdit={permissions.canEditSyllabus(activeSubject as Syllabus)}
        currentSchemeId={schemeId}
      />
    </div>
  );
}

function SubjectRow({ sub, permissions, isOption, onEdit, onDelete }: any) {
  const canEdit = permissions.canEditSyllabus(sub);
  return (
    <TableRow className={`group transition-colors ${isOption ? 'bg-muted/30' : ''}`}>
      <TableCell className={`font-mono text-xs font-bold text-primary ${isOption ? 'pl-10' : 'pl-6'}`}>{sub.subjectCode}</TableCell>
      <TableCell className="font-medium">
        <div className="flex flex-col">
          <span>{sub.title}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{sub.type}</span>
        </div>
      </TableCell>
      <TableCell><Badge variant="secondary" className="text-[9px] font-bold">{sub.creditCategory}</Badge></TableCell>
      <TableCell className="text-right font-bold text-sm">{sub.credits}</TableCell>
      <TableCell className="text-right pr-6">
        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500" onClick={() => exportSyllabusToPDF(sub)}>
            <FileDown className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={onEdit}>
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          {permissions.canEditScheme && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={onDelete}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}