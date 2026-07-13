
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Program, Scheme, Syllabus, Feedback } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut, GraduationCap, Search, BookOpen, Loader2, Info, CheckCircle2, MessageSquare, Send, ArrowRight, ShieldCheck, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { exportFullSchemeToPDF, exportCompleteSyllabusToPDF } from "@/lib/pdf-export";

export default function GuestExplorerPage() {
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUser();

  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("All");
  
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loadingSyllabi, setLoadingSyllabi] = useState(false);

  const [feedbackForm, setFeedbackForm] = useState({ name: '', email: '', phone: '', feedback: '' });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const { data: programs, loading: programsLoading } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));
  
  const schemesQuery = useMemoFirebase(() => {
    return query(collection(db, 'schemes'), where('status', '==', 'Approved'));
  }, [db]);
  const { data: approvedSchemes } = useCollection<Scheme>(schemesQuery);

  const availableBranches = useMemo(() => {
    if (!selectedProgramId) return [];
    return programs.find(p => p.id === selectedProgramId)?.branches || [];
  }, [selectedProgramId, programs]);

  const availableBatches = useMemo(() => {
    if (!selectedProgramId || !selectedBranch) return [];
    return Array.from(new Set(approvedSchemes
      .filter(s => s.programId === selectedProgramId && s.branch === selectedBranch)
      .map(s => s.batchYear)));
  }, [selectedProgramId, selectedBranch, approvedSchemes]);

  useEffect(() => {
    if (selectedProgramId && selectedBranch && selectedBatch) {
      const found = approvedSchemes.find(s => 
        s.programId === selectedProgramId && 
        s.branch === selectedBranch && 
        s.batchYear === selectedBatch
      );
      if (found) {
        setScheme(found);
        setLoadingSyllabi(true);
        getDocs(collection(db, 'schemes', found.id, 'syllabi')).then(snap => {
          setSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
          setLoadingSyllabi(false);
        });
      }
    } else {
      setScheme(null);
      setSyllabi([]);
    }
  }, [selectedProgramId, selectedBranch, selectedBatch, approvedSchemes, db]);

  const filteredSyllabi = useMemo(() => {
    if (selectedSemester === "All") return syllabi;
    return syllabi.filter(s => s.semester === Number(selectedSemester));
  }, [syllabi, selectedSemester]);

  const handleLogout = () => {
    auth.signOut().then(() => router.push('/'));
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.name || !feedbackForm.email || !feedbackForm.feedback || !scheme) {
      toast({ title: "Validation Error", description: "Complete all required fields.", variant: "destructive" });
      return;
    }
    setIsSubmittingFeedback(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        ...feedbackForm,
        schemeId: scheme.id,
        createdAt: serverTimestamp()
      });
      toast({ title: "Feedback Registered", description: "Thank you for contributing to institutional excellence." });
      setFeedbackForm({ name: '', email: '', phone: '', feedback: '' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  if (programsLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-muted/5">
      <header className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 bg-primary rounded-lg flex items-center justify-center font-black text-white text-xs">RTU</div>
          <div>
            <h1 className="text-lg font-headline font-bold text-primary leading-none">Guest Explorer</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">Institutional Registry</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-600 gap-2">
          <LogOut className="w-4 h-4" /> Exit Portal
        </Button>
      </header>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        <Card className="border-primary/10 shadow-lg bg-gradient-to-br from-white to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Curriculum Discovery Engine
            </CardTitle>
            <CardDescription>Select institutional parameters to browse approved academic structures.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">1. Program Framework</Label>
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Program..." /></SelectTrigger>
                <SelectContent>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">2. Technical Branch</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch} disabled={!selectedProgramId}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Branch..." /></SelectTrigger>
                <SelectContent>
                  {availableBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">3. Admission Batch</Label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch} disabled={!selectedBranch}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Batch..." /></SelectTrigger>
                <SelectContent>
                  {availableBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {scheme ? (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-headline font-bold text-primary">{selectedBranch}</h2>
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">ACCREDITED SCHEME</Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="font-mono font-bold">{scheme.schemeCode}</span>
                  <span>Batch: {scheme.batchYear}</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> RTU-NEP 2020 Compliant</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => exportFullSchemeToPDF(scheme, programs.find(p => p.id === scheme.programId) || null, syllabi)}>
                  <Download className="w-4 h-4" /> Structure PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => exportCompleteSyllabusToPDF(scheme, programs.find(p => p.id === scheme.programId) || null, syllabi)}>
                  <BookOpen className="w-4 h-4" /> Syllabus Book
                </Button>
              </div>
            </div>

            <Tabs defaultValue="structure">
              <TabsList className="bg-white border mb-6">
                <TabsTrigger value="structure">Academic Structure</TabsTrigger>
                <TabsTrigger value="syllabi">Detailed Syllabus</TabsTrigger>
                <TabsTrigger value="feedback">Institutional Feedback</TabsTrigger>
              </TabsList>

              <TabsContent value="structure">
                <div className="grid grid-cols-1 gap-6">
                   {Array.from({ length: 8 }, (_, i) => i + 1).map(sem => {
                     const semSyllabi = syllabi.filter(s => s.semester === sem).sort((a,b) => (a.timetableSlot||'').localeCompare(b.timetableSlot||''));
                     if (semSyllabi.length === 0) return null;

                     return (
                       <Card key={sem} className="shadow-sm border-none overflow-hidden">
                         <CardHeader className="bg-muted/20 py-3 px-6 flex flex-row items-center justify-between">
                            <CardTitle className="text-lg">Semester {sem}</CardTitle>
                            <Badge variant="outline" className="bg-white">{semSyllabi.reduce((sum, s) => sum + (s.credits || 0), 0)} Credits</Badge>
                         </CardHeader>
                         <CardContent className="p-0">
                           <Table>
                             <TableHeader>
                               <TableRow>
                                 <TableHead className="pl-6 w-32">Subject Code</TableHead>
                                 <TableHead>Course Title</TableHead>
                                 <TableHead>Category</TableHead>
                                 <TableHead className="text-center w-24">L-T-P</TableHead>
                                 <TableHead className="text-right pr-6 w-20">Credits</TableHead>
                               </TableRow>
                             </TableHeader>
                             <TableBody>
                               {semSyllabi.map(sub => (
                                 <TableRow key={sub.id}>
                                   <TableCell className="pl-6 font-mono font-bold text-primary">{sub.subjectCode}</TableCell>
                                   <TableCell>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{sub.title}</span>
                                        <span className="text-[10px] text-muted-foreground uppercase">{sub.type}</span>
                                      </div>
                                   </TableCell>
                                   <TableCell><Badge variant="secondary" className="text-[9px] font-bold">{sub.creditCategory}</Badge></TableCell>
                                   <TableCell className="text-center font-mono text-xs">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell>
                                   <TableCell className="text-right pr-6 font-black">{sub.credits}</TableCell>
                                 </TableRow>
                               ))}
                             </TableBody>
                           </Table>
                         </CardContent>
                       </Card>
                     );
                   })}
                </div>
              </TabsContent>

              <TabsContent value="syllabi">
                <div className="flex flex-col gap-6">
                  <div className="bg-white p-4 rounded-xl border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Label className="font-bold text-xs uppercase text-muted-foreground">Filter by Semester</Label>
                      <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Semesters</SelectItem>
                          {[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-black">{filteredSyllabi.length} Active Courses</Badge>
                  </div>

                  <div className="space-y-8">
                    {filteredSyllabi.map((sub, idx) => (
                      <Card key={sub.id} className="border-none shadow-sm overflow-hidden">
                        <CardHeader className="bg-primary/5 py-4 border-b">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-black uppercase text-primary tracking-widest">{sub.creditCategory} | Semester {sub.semester}</p>
                              <CardTitle className="text-xl">{sub.subjectCode} - {sub.title}</CardTitle>
                            </div>
                            <Badge className="bg-white text-primary border-primary/20">{sub.credits} Credits</Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-6">
                              <h4 className="font-bold text-sm uppercase text-primary border-l-4 border-primary pl-3">Syllabus Units</h4>
                              <div className="space-y-4">
                                {sub.units?.map((unit, uIdx) => (
                                  <div key={unit.id} className="p-4 bg-muted/20 rounded-xl border space-y-2">
                                    <div className="flex items-center justify-between">
                                      <p className="font-bold text-sm">Unit {uIdx + 1}: {unit.title}</p>
                                      <Badge variant="outline" className="bg-white text-[9px]">{unit.hours} Hours</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{unit.content}</p>
                                    <div className="pt-2 flex items-center gap-2 text-[10px] font-medium text-primary italic">
                                      <Info className="w-3 h-3" /> Course Outcome: {unit.courseOutcome}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-6">
                               <div className="space-y-3">
                                 <h4 className="font-bold text-sm uppercase text-primary border-l-4 border-primary pl-3">Resources</h4>
                                 <div className="space-y-4">
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Textbooks</p>
                                      <ul className="text-xs space-y-1.5 list-disc pl-4 text-muted-foreground">
                                        {sub.textBooks?.map((b, i) => <li key={i}>{b}</li>)}
                                      </ul>
                                    </div>
                                    <div className="space-y-1">
                                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Reference Materials</p>
                                      <ul className="text-xs space-y-1.5 list-disc pl-4 text-muted-foreground">
                                        {sub.referenceBooks?.map((b, i) => <li key={i}>{b}</li>)}
                                      </ul>
                                    </div>
                                 </div>
                               </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="feedback">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 py-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <h3 className="text-2xl font-headline font-bold text-primary">Technical Observations</h3>
                      <p className="text-muted-foreground">Your feedback directly influences the next cycle of Board of Studies (BoS) revisions. Please identify specific pedagogical or structural improvements.</p>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4">
                       <div className="flex items-center gap-3 text-emerald-800 font-bold">
                         <ShieldCheck className="w-6 h-6" /> Institutional Quality Assurance
                       </div>
                       <p className="text-sm text-emerald-700 leading-relaxed">
                         Feedback collected here is reviewed by the **Dean Academic** and the **Branch Committee Convenors** during official curriculum auditing sessions.
                       </p>
                    </div>
                  </div>

                  <Card className="shadow-xl border-primary/10">
                    <CardHeader className="bg-primary/5 border-b py-4">
                      <CardTitle className="text-lg flex items-center gap-2"><MessageSquare className="w-5 h-5 text-primary" /> Submit Feedback</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase">Your Full Name</Label>
                          <Input value={feedbackForm.name} onChange={e => setFeedbackForm({...feedbackForm, name: e.target.value})} placeholder="Prof. John Doe" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase">Contact Email</Label>
                          <Input value={feedbackForm.email} onChange={e => setFeedbackForm({...feedbackForm, email: e.target.value})} placeholder="john@example.com" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase">Phone Number</Label>
                        <Input value={feedbackForm.phone} onChange={e => setFeedbackForm({...feedbackForm, phone: e.target.value})} placeholder="+91 98XXX XXXXX" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase">Observations / Recommendations</Label>
                        <Textarea 
                          value={feedbackForm.feedback} 
                          onChange={e => setFeedbackForm({...feedbackForm, feedback: e.target.value})} 
                          placeholder="Suggest changes to unit topics, course outcomes, or textbook editions..."
                          className="min-h-[150px]"
                        />
                      </div>
                      <Button className="w-full h-12 gap-2" onClick={handleSubmitFeedback} disabled={isSubmittingFeedback}>
                        {isSubmittingFeedback ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Submit Technical Observation
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
            <BookOpen className="w-20 h-20 text-primary" />
            <div className="text-center">
              <h3 className="text-xl font-headline font-bold">Select Parameters to Begin</h3>
              <p className="text-sm">Choose a program, branch, and batch to browse approved records.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-12 border-t mt-12 bg-white">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-4">
          <p className="text-xs text-muted-foreground uppercase font-black tracking-widest">Rajasthan Technical University, Kota</p>
          <div className="flex items-center justify-center gap-6">
             <span className="text-[10px] text-muted-foreground">© 2024 Academia Flow System</span>
             <span className="text-[10px] text-muted-foreground">|</span>
             <span className="text-[10px] text-muted-foreground">Official Academic Transparency Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
