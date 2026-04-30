"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Save, Send, History, Trash2, Edit3, Download, GraduationCap, Layers } from "lucide-react";
import { MOCK_PROGRAMS } from "@/lib/mock-data";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, SchemeStatus } from "@/lib/types";

export default function SchemeDetailPage({ params }: { params: { id: string } }) {
  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);
  
  // Mock State
  const [scheme, setScheme] = useState<Partial<Scheme>>({
    id: 's1',
    programId: 'btech-cs',
    batchYear: '2024-28',
    status: 'Draft',
    version: 'v1.0',
    hasMultipleExits: true,
    exitOptions: ['Certificate', 'Diploma'],
    abcEnabled: true
  });

  const [subjects, setSubjects] = useState<Syllabus[]>([
    {
      id: 'sub1',
      schemeId: 's1',
      subjectCode: 'CS101',
      title: 'Introduction to Programming',
      type: 'Theory',
      credits: 4,
      semester: 1,
      creditCategory: 'DSC',
      prerequisites: [],
      courseOutcomes: [],
      programOutcomes: [],
      resources: []
    },
    {
      id: 'sub2',
      schemeId: 's1',
      subjectCode: 'CS102L',
      title: 'Programming Lab',
      type: 'Practical/Lab',
      credits: 2,
      semester: 1,
      creditCategory: 'DSC',
      prerequisites: [],
      courseOutcomes: [],
      programOutcomes: [],
      resources: []
    }
  ]);

  const creditDistribution = subjects.reduce((acc, sub) => {
    acc[sub.creditCategory] = (acc[sub.creditCategory] || 0) + sub.credits;
    acc.total += sub.credits;
    return acc;
  }, { DSC: 0, DSE: 0, OFE: 0, CPF: 0, total: 0 });

  const program = MOCK_PROGRAMS.find(p => p.id === scheme.programId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold">{program?.name}</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-none font-medium">
              {scheme.version}
            </Badge>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span>Batch: {scheme.batchYear}</span>
            <span className="w-1 h-1 rounded-full bg-border"></span>
            <span>Status: </span>
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100">{scheme.status}</Badge>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Save className="w-4 h-4" /> Save Draft
          </Button>
          <Button className="gap-2 shadow-lg">
            <Send className="w-4 h-4" /> Submit for Approval
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-3 space-y-6">
          <Tabs defaultValue="syllabi" className="w-full">
            <TabsList className="bg-white border p-1 h-12 w-full justify-start gap-2">
              <TabsTrigger value="syllabi" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
                Course Structure
              </TabsTrigger>
              <TabsTrigger value="nep" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
                NEP 2020 Builder
              </TabsTrigger>
              <TabsTrigger value="history" className="h-10 px-6 data-[state=active]:bg-primary data-[state=active]:text-white">
                Audit & Versioning
              </TabsTrigger>
            </TabsList>

            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => {
                const semSubjects = subjects.filter(s => s.semester === sem);
                if (semSubjects.length === 0 && sem > 1) return null;
                
                return (
                  <Card key={sem} className="shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between bg-muted/20 py-4">
                      <div>
                        <CardTitle className="text-lg">Semester {sem}</CardTitle>
                        <CardDescription>Total Semester Credits: {semSubjects.reduce((a,b) => a + b.credits, 0)}</CardDescription>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                        setActiveSubject({ semester: sem });
                        setIsSyllabusDialogOpen(true);
                      }}>
                        <Plus className="w-4 h-4" /> Add Subject
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-24">Code</TableHead>
                            <TableHead>Subject Title</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Credits</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {semSubjects.map(sub => (
                            <TableRow key={sub.id}>
                              <TableCell className="font-mono text-xs font-bold">{sub.subjectCode}</TableCell>
                              <TableCell className="font-medium">{sub.title}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase">{sub.type}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-[10px] font-bold">{sub.creditCategory}</Badge>
                              </TableCell>
                              <TableCell className="text-right font-bold">{sub.credits}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => {
                                    setActiveSubject(sub);
                                    setIsSyllabusDialogOpen(true);
                                  }}>
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {semSubjects.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm italic">
                                No subjects added for this semester yet.
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
              <Card>
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
                          onCheckedChange={checked => setScheme({...scheme, hasMultipleExits: checked})}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border rounded-xl bg-muted/10">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold">ABC Integration</Label>
                          <p className="text-sm text-muted-foreground">Enable Academic Bank of Credits sync.</p>
                        </div>
                        <Switch 
                          checked={scheme.abcEnabled}
                          onCheckedChange={checked => setScheme({...scheme, abcEnabled: checked})}
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
              <Card>
                <CardHeader>
                  <CardTitle className="font-headline flex items-center gap-2">
                    <History className="w-5 h-5 text-muted-foreground" />
                    Revision History
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-border">
                    <AuditItem version="v1.0" action="Draft Created" user="Sarah Smith" date="Oct 12, 2023" />
                    <AuditItem version="v0.9" action="Initial Layout Import" user="Admin" date="Oct 10, 2023" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <CreditValidator currentCredits={creditDistribution} />
          
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
        onSave={(data) => {
          if (data.id) {
            setSubjects(subjects.map(s => s.id === data.id ? data as Syllabus : s));
          } else {
            const newSub = { ...data, id: Math.random().toString() } as Syllabus;
            setSubjects([...subjects, newSub]);
          }
        }}
      />
    </div>
  );
}

function ExitOption({ label, credits, active }: { label: string, credits: string, active: boolean }) {
  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between transition-all ${active ? 'border-primary/20 bg-primary/5' : 'bg-muted/50 border-border opacity-60'}`}>
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
