
'use client';

import React, { useState, useMemo } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, deleteDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Send, History, Trash2, Edit3, Download, GraduationCap, Layers, Loader2, ShieldAlert, FileDown } from "lucide-react";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, Program, UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { exportSyllabusToPDF } from "@/lib/pdf-export";
import Link from "next/link";

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
  const { data: syllabi, loading: syllabiLoading } = useCollection<Syllabus>(syllabiRef);

  const programRef = useMemoFirebase(() => (scheme?.programId ? doc(db, 'programs', scheme.programId) : null), [db, scheme?.programId]);
  const { data: program } = useDoc<Program>(programRef);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);

  const hasEditPermission = useMemo(() => {
    if (!profile || !scheme) return false;
    if (profile.role === 'admin' || profile.role === 'dean_faculty' || profile.role === 'dean_academics') return true;
    
    // BoS Convenor check
    return profile.managedBranches?.some(
      m => m.programId === scheme.programId && m.branch === scheme.branch
    ) || false;
  }, [profile, scheme]);

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, CPF: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, total: 0 };
    syllabi.forEach(sub => {
      dist[sub.creditCategory] = (dist[sub.creditCategory] || 0) + (sub.credits || 0);
      dist.total += (sub.credits || 0);
    });
    return dist;
  }, [syllabi]);

  const handleUpdateScheme = (updates: Partial<Scheme>) => {
    if (!hasEditPermission) return;
    updateDoc(schemeRef, { ...updates, updatedAt: serverTimestamp() })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: schemeRef.path,
          operation: 'update',
          requestResourceData: updates
        }));
      });
  };

  const handleSaveSyllabus = (data: Partial<Syllabus>) => {
    if (!hasEditPermission) return;
    const syllabusId = data.id || doc(collection(db, 'temp')).id;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', syllabusId);
    
    setDoc(docRef, { ...data, id: syllabusId }, { merge: true })
      .then(() => toast({ title: "Syllabus Saved" }))
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data
        }));
      });
  };

  const handleDeleteSyllabus = (id: string) => {
    if (!hasEditPermission) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', id);
    deleteDoc(docRef).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete'
      }));
    });
  };

  const handleExportPDF = (syllabus: Syllabus) => {
    exportSyllabusToPDF(syllabus, program?.name, scheme?.branch, scheme?.batchYear);
    toast({ title: "PDF Generated", description: `${syllabus.subjectCode} syllabus downloaded.` });
  };

  if (schemeLoading || syllabiLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!scheme) return <div className="p-8 text-center text-muted-foreground">Scheme not found.</div>;

  if (!hasEditPermission) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="bg-red-50 p-4 rounded-full">
          <ShieldAlert className="w-12 h-12 text-red-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Unauthorized Access</h2>
          <p className="text-muted-foreground max-w-md mt-2">
            You do not have authorization to manage schemes for {program?.name} ({scheme.branch}). 
            Please contact your Dean Academics for authorization.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/schemes">Return to My Schemes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold">{program?.name || 'Academic Layout'}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-none font-medium">
              {scheme.version}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span>Branch: <span className="font-bold text-foreground">{scheme.branch || 'General'}</span></span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Batch: {scheme.batchYear}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Status: </span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">{scheme.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => toast({ title: "Draft Saved Locally" })}>
            <Save className="w-4 h-4" /> Save Work
          </Button>
          <Button className="gap-2 shadow-lg" onClick={() => handleUpdateScheme({ status: 'Pending Dean' })}>
            <Send className="w-4 h-4" /> Submit for Approval
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-6">
          <Tabs defaultValue="syllabi" className="w-full">
            <TabsList className="bg-white border p-1 h-12 w-full justify-start gap-2 overflow-x-auto">
              <TabsTrigger value="syllabi" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white whitespace-nowrap">
                Course Structure
              </TabsTrigger>
              <TabsTrigger value="nep" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white whitespace-nowrap">
                NEP 2020 Builder
              </TabsTrigger>
              <TabsTrigger value="history" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white whitespace-nowrap">
                Audit & Versioning
              </TabsTrigger>
            </TabsList>

            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {Array.from({ length: program?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                const semSubjects = syllabi.filter(s => s.semester === sem);
                const semTotal = semSubjects.reduce((a, b) => a + (b.credits || 0), 0);
                
                return (
                  <Card key={sem} className="shadow-sm border-none bg-white overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 py-4 px-6">
                      <div className="space-y-0.5">
                        <CardTitle className="text-lg font-headline">Semester {sem}</CardTitle>
                        <CardDescription className="text-xs font-medium">Credits: <span className="text-primary font-bold">{semTotal}</span></CardDescription>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2 h-9 rounded-lg" onClick={() => {
                        setActiveSubject({ semester: sem });
                        setIsSyllabusDialogOpen(true);
                      }}>
                        <Plus className="w-4 h-4" /> Add Subject
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader className="bg-muted/10">
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-24 pl-6">Code</TableHead>
                            <TableHead>Subject Title</TableHead>
                            <TableHead className="w-24 text-center">L-T-P</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {semSubjects.map(sub => (
                            <TableRow key={sub.id} className="group transition-colors">
                              <TableCell className="font-mono text-xs font-bold pl-6 text-primary">{sub.subjectCode}</TableCell>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{sub.title}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase">{sub.type}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="text-xs font-mono text-muted-foreground">
                                  {sub.lectureCredits || 0}-{sub.tutorialCredits || 0}-{sub.practicalCredits || 0}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0.5">{sub.creditCategory}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold text-sm">{sub.credits}</TableCell>
                              <TableCell className="text-right pr-6">
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50" title="Export PDF" onClick={() => handleExportPDF(sub)}>
                                    <FileDown className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => {
                                    setActiveSubject(sub);
                                    setIsSyllabusDialogOpen(true);
                                  }}>
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:bg-red-50" onClick={() => handleDeleteSyllabus(sub.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {semSubjects.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm italic">
                                No subjects added for this semester. Click "Add Subject" to begin.
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

            <TabsContent value="nep" className="mt-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="font-headline">NEP 2020 Configurations</CardTitle>
                  <CardDescription>Setup Academic Bank of Credits and Exit pathways.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold">Multiple Entry/Exit Options</Label>
                          <p className="text-sm text-muted-foreground">Allow students to exit with Cert/Diploma.</p>
                        </div>
                        <Switch 
                          checked={scheme.hasMultipleExits}
                          onCheckedChange={checked => handleUpdateScheme({ hasMultipleExits: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold">ABC Integration</Label>
                          <p className="text-sm text-muted-foreground">Enable Academic Bank of Credits sync.</p>
                        </div>
                        <Switch 
                          checked={scheme.abcEnabled}
                          onCheckedChange={checked => handleUpdateScheme({ abcEnabled: checked })}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label className="text-base font-semibold">Exit Pathways</Label>
                      <div className="grid grid-cols-1 gap-3">
                         <ExitOption label="Certificate" credits="40 Credits" active={scheme.exitOptions?.includes('Certificate')} />
                         <ExitOption label="Diploma" credits="80 Credits" active={scheme.exitOptions?.includes('Diploma')} />
                         <ExitOption label="UG Degree" credits="120 Credits" active={true} />
                         <ExitOption label="Degree with Honours" credits="160 Credits" active={true} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <Card className="border-none shadow-sm">
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    Revision History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
                    <AuditItem version={scheme.version} action="Last Updated" user={profile?.displayName || 'Authorized User'} date={scheme.updatedAt?.toDate().toLocaleDateString() || 'Today'} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <CreditValidator currentCredits={creditDistribution} rules={program?.rules} />
          
          <Card className="shadow-sm border-accent/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-headline flex items-center gap-2 text-accent">
                <Download className="w-4 h-4" />
                Exports & Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-2">
              <Button variant="outline" size="sm" className="justify-start gap-2 h-11 text-xs font-medium">
                <Download className="w-4 h-4" /> Export for TEQIP-III MIS (JSON)
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-11 text-xs font-medium">
                <GraduationCap className="w-4 h-4" /> NAAC Compliance Report
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-11 text-xs font-medium">
                <Layers className="w-4 h-4" /> AICTE Criteria Mapping
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SyllabusDialog 
        open={isSyllabusDialogOpen} 
        onOpenChange={setIsSyllabusDialogOpen} 
        syllabus={activeSubject}
        onSave={handleSaveSyllabus}
        programName={program?.name}
        branchName={scheme?.branch}
        batchYear={scheme?.batchYear}
      />
    </div>
  );
}

function ExitOption({ label, credits, active }: { label: string, credits: string, active: boolean }) {
  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${active ? 'border-primary/20 bg-primary/5 shadow-sm' : 'bg-muted/50 border-border opacity-60'}`}>
      <div className="space-y-0.5">
        <p className="font-semibold text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{credits}</p>
      </div>
      <div className={`w-4 h-4 rounded-full border-2 ${active ? 'bg-primary border-primary' : 'border-muted-foreground'}`}></div>
    </div>
  );
}

function AuditItem({ version, action, user, date }: any) {
  return (
    <div className="relative">
      <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full bg-border border-2 border-white"></div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{version}</span>
          <p className="text-sm font-semibold">{action}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>By {user}</span>
          <span className="w-1 h-1 rounded-full bg-border"></span>
          <span>{date}</span>
        </div>
      </div>
    </div>
  );
}
