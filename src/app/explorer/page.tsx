
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Program, Scheme, Syllabus } from '@/lib/types';
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
import { LogOut, Search, BookOpen, Loader2, Info, CheckCircle2, MessageSquare, Send, Download, ShieldCheck, Phone, Mail, User, ShieldAlert, GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { exportFullSchemeToPDF, exportCompleteSyllabusToPDF } from "@/lib/pdf-export";
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';

export default function GuestExplorerPage() {
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading: userLoading } = useUser();
  
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("All");
  
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loadingSyllabi, setLoadingSyllabi] = useState(false);

  const [feedbackForm, setFeedbackForm] = useState({ name: '', email: '', phone: '', feedback: '' });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Security: Redirect unauthorized access back to home
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/');
    }
  }, [user, userLoading, router]);

  const { data: programs, loading: programsLoading } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));
  
  const schemesQuery = useMemoFirebase(() => {
    return query(collection(db, 'schemes'), where('status', '==', 'Approved'));
  }, [db]);
  const { data: approvedSchemes } = useCollection<Scheme>(schemesQuery);

  const availableBranches = useMemo(() => {
    if (!selectedProgramId) return [];
    const branchSet = new Set(approvedSchemes
      .filter(s => s.programId === selectedProgramId)
      .map(s => s.branch));
    return Array.from(branchSet).filter(Boolean) as string[];
  }, [selectedProgramId, approvedSchemes]);

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
        }).catch(err => {
          console.error("Syllabi load error:", err);
          setLoadingSyllabi(false);
        });
      }
    } else {
      setScheme(null);
      setSyllabi([]);
    }
  }, [selectedProgramId, selectedBranch, selectedBatch, approvedSchemes, db]);

  const filteredSyllabi = useMemo(() => {
    const sorted = [...syllabi].sort((a, b) => {
      if (a.semester !== b.semester) return (a.semester || 1) - (b.semester || 1);
      const slotA = a.timetableSlot || "Z";
      const slotB = b.timetableSlot || "Z";
      return slotA.localeCompare(slotB, undefined, { numeric: true });
    });
    if (selectedSemester === "All") return sorted;
    return sorted.filter(s => s.semester === Number(selectedSemester));
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
      toast({ title: "Observation Submitted", description: "Your pedagogical feedback has been recorded for BoS review." });
      setFeedbackForm({ name: '', email: '', phone: '', feedback: '' });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Submission Failed", description: e.message });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const rtuLogo = PlaceHolderImages.find(img => img.id === 'rtu-logo');

  if (userLoading || programsLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-muted/5 flex flex-col">
      <header className="h-20 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 flex items-center justify-center bg-white rounded-xl border border-primary/10 p-1">
             {rtuLogo && (
               <Image 
                 src={rtuLogo.imageUrl} 
                 alt="RTU Logo" 
                 width={40} 
                 height={40} 
                 className="object-contain" 
                 unoptimized
                 priority
                 data-ai-hint="RTU Logo" 
               />
             )}
          </div>
          <div className="border-l pl-4">
            <h1 className="text-xl font-headline font-bold text-primary leading-tight">Institutional Explorer</h1>
            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Rajasthan Technical University, Kota</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 h-8">
             <ShieldCheck className="w-3.5 h-3.5" /> Public Access Active
           </Badge>
           <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-red-600 gap-2 h-9">
            <LogOut className="w-4 h-4" /> Exit Portal
          </Button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-8 space-y-10">
        <Card className="border-primary/10 shadow-xl bg-gradient-to-br from-white to-primary/5 overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Search className="w-32 h-32 text-primary" />
          </div>
          <CardHeader className="pb-8 border-b bg-white/50 backdrop-blur-sm">
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2 bg-primary rounded-lg text-white"><Search className="w-5 h-5" /></div>
              Curriculum Search Engine
            </CardTitle>
            <CardDescription className="text-sm font-medium">Discover official, approved academic structures and subject syllabi for RTU-NEP 2020.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            <div className="space-y-2.5">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5" /> 1. Academic Framework
              </Label>
              <Select value={selectedProgramId} onValueChange={(v) => { setSelectedProgramId(v); setSelectedBranch(""); setSelectedBatch(""); }}>
                <SelectTrigger className="bg-white h-11 border-primary/20 focus:ring-primary/20">
                  <SelectValue placeholder="Select Program..." />
                </SelectTrigger>
                <SelectContent>
                  {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> 2. Technical Branch
              </Label>
              <Select value={selectedBranch} onValueChange={(v) => { setSelectedBranch(v); setSelectedBatch(""); }} disabled={!selectedProgramId}>
                <SelectTrigger className="bg-white h-11 border-primary/20">
                  <SelectValue placeholder="Select Branch..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBranches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[11px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5" /> 3. Enrollment Batch
              </Label>
              <Select value={selectedBatch} onValueChange={setSelectedBatch} disabled={!selectedBranch}>
                <SelectTrigger className="bg-white h-11 border-primary/20">
                  <SelectValue placeholder="Select Batch..." />
                </SelectTrigger>
                <SelectContent>
                  {availableBatches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {scheme ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-4xl font-headline font-black text-primary tracking-tight">{selectedBranch}</h2>
                  <Badge className="bg-emerald-600 text-white border-none px-3 py-1 text-[10px] font-bold">ACCREDITED SCHEME</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /> <span className="font-mono font-bold text-primary">{scheme.schemeCode}</span></div>
                  <div className="flex items-center gap-2 font-bold">Batch: <span className="text-foreground">{scheme.batchYear}</span></div>
                  <div className="flex items-center gap-2 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"><ShieldCheck className="w-4 h-4" /> RTU-NEP 2020 Compliance</div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="gap-2 h-11 px-6 shadow-sm hover:bg-primary/5 hover:text-primary border-primary/20" onClick={() => exportFullSchemeToPDF(scheme, programs.find(p => p.id === scheme.programId) || null, syllabi)}>
                  <Download className="w-4 h-4" /> Structure PDF
                </Button>
                <Button className="gap-2 h-11 px-6 shadow-lg shadow-primary/10" onClick={() => exportCompleteSyllabusToPDF(scheme, programs.find(p => p.id === scheme.programId) || null, syllabi)}>
                  <BookOpen className="w-4 h-4" /> Syllabus Book
                </Button>
              </div>
            </div>

            <Tabs defaultValue="structure" className="space-y-8">
              <TabsList className="bg-white border p-1 h-14 w-full md:w-fit shadow-sm rounded-xl">
                <TabsTrigger value="structure" className="h-11 px-8 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Academic Structure</TabsTrigger>
                <TabsTrigger value="syllabi" className="h-11 px-8 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Course Syllabus</TabsTrigger>
                <TabsTrigger value="feedback" className="h-11 px-8 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-white">Public Feedback</TabsTrigger>
              </TabsList>

              <TabsContent value="structure" className="space-y-8">
                {Array.from({ length: 8 }, (_, i) => i + 1).map(sem => {
                  const semSyllabi = syllabi.filter(s => s.semester === sem).sort((a,b) => (a.timetableSlot||'').localeCompare(b.timetableSlot||'', undefined, {numeric: true}));
                  if (semSyllabi.length === 0) return null;

                  return (
                    <Card key={sem} className="shadow-xl border-none overflow-hidden rounded-2xl">
                      <CardHeader className="bg-muted/30 py-5 px-8 flex flex-row items-center justify-between border-b">
                         <div className="flex items-center gap-4">
                           <div className="h-10 w-10 rounded-full bg-primary text-white flex items-center justify-center font-bold text-lg shadow-inner">{sem}</div>
                           <CardTitle className="text-xl">Semester {sem}</CardTitle>
                         </div>
                         <Badge variant="outline" className="bg-white px-4 py-1.5 text-[11px] font-black border-primary/20 shadow-sm">
                           Total: {semSyllabi.reduce((sum, s) => sum + (s.credits || 0), 0)} Credits
                         </Badge>
                      </CardHeader>
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader className="bg-muted/10">
                            <TableRow>
                              <TableHead className="pl-8 w-40 text-[10px] uppercase font-black text-muted-foreground tracking-widest">Code</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Course Title</TableHead>
                              <TableHead className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">Category</TableHead>
                              <TableHead className="text-center w-32 text-[10px] uppercase font-black text-muted-foreground tracking-widest">L-T-P</TableHead>
                              <TableHead className="text-right pr-8 w-24 text-[10px] uppercase font-black text-muted-foreground tracking-widest">Credits</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {semSyllabi.map(sub => (
                              <TableRow key={sub.id} className="hover:bg-muted/5 transition-colors group">
                                <TableCell className="pl-8 font-mono font-bold text-primary text-sm tracking-tight">{sub.subjectCode}</TableCell>
                                <TableCell>
                                   <div className="flex flex-col gap-0.5">
                                     <span className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{sub.title}</span>
                                     <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{sub.type}</span>
                                   </div>
                                </TableCell>
                                <TableCell><Badge variant="secondary" className="text-[9px] font-black tracking-tighter h-5">{sub.creditCategory}</Badge></TableCell>
                                <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell>
                                <TableCell className="text-right pr-8 font-black text-primary">{sub.credits}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  );
                })}
              </TabsContent>

              <TabsContent value="syllabi" className="space-y-8">
                <div className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="p-2.5 bg-primary/5 rounded-xl border border-primary/10"><Info className="w-5 h-5 text-primary" /></div>
                    <div>
                      <Label className="font-black text-[10px] uppercase text-muted-foreground tracking-widest leading-none mb-1.5 block">Syllabus Directory</Label>
                      <p className="text-sm font-bold text-primary">Browse individual unit patterns and learning outcomes.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-full md:w-auto border-l pl-6 ml-auto">
                    <Label className="font-bold text-xs uppercase text-muted-foreground whitespace-nowrap">Filter Semester</Label>
                    <Select value={selectedSemester} onValueChange={setSelectedSemester}>
                      <SelectTrigger className="w-40 h-10 border-primary/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">Complete Course</SelectItem>
                        {[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-12">
                  {filteredSyllabi.map((sub, idx) => (
                    <Card key={sub.id} className="border-none shadow-2xl shadow-primary/5 rounded-3xl overflow-hidden relative">
                      <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
                      <CardHeader className="bg-primary/5 py-8 px-10 border-b relative">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div>
                            <div className="flex items-center gap-3 mb-2.5">
                              <Badge className="bg-primary text-white border-none text-[10px] px-3 font-bold">{sub.creditCategory}</Badge>
                              <Badge variant="outline" className="bg-white border-primary/20 text-[10px] px-3 font-bold uppercase tracking-wider">Semester {sub.semester}</Badge>
                            </div>
                            <CardTitle className="text-3xl font-headline font-black text-primary tracking-tight leading-none">
                              {sub.subjectCode} - {sub.title}
                            </CardTitle>
                          </div>
                          <div className="flex flex-col items-center justify-center bg-white rounded-2xl px-8 py-3 border shadow-sm min-w-[120px]">
                            <span className="text-3xl font-black text-primary leading-none">{sub.credits}</span>
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1">Credits</span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-10">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                          <div className="lg:col-span-8 space-y-8">
                            <div className="flex items-center gap-3 border-b-2 border-primary pb-3 mb-6">
                               <ShieldCheck className="w-5 h-5 text-primary" />
                               <h4 className="font-headline font-black text-lg uppercase tracking-tight text-primary">Pedagogical Units & Outcomes</h4>
                            </div>
                            <div className="grid gap-6">
                              {sub.units?.map((unit, uIdx) => (
                                <div key={unit.id} className="p-6 bg-muted/20 rounded-2xl border border-muted-foreground/10 group hover:border-primary/30 transition-all shadow-sm">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-4">
                                      <div className="h-10 w-10 rounded-xl bg-white border border-primary/10 flex items-center justify-center font-black text-primary shadow-sm text-sm group-hover:bg-primary group-hover:text-white transition-colors">{uIdx + 1}</div>
                                      <p className="font-black text-lg tracking-tight text-foreground/90">{unit.title}</p>
                                    </div>
                                    <Badge variant="outline" className="bg-white text-[10px] font-black h-7 border-muted-foreground/20">{unit.hours} Hours</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground leading-relaxed pl-14 pr-4 border-l-2 border-muted-foreground/10 mb-6">{unit.content}</p>
                                  <div className="pl-14 pt-4 mt-4 border-t border-muted-foreground/5 flex items-center gap-3">
                                    <div className="px-2 py-0.5 bg-primary/10 rounded text-[9px] font-black text-primary uppercase">Learning Outcome</div>
                                    <p className="text-[11px] font-bold text-primary italic leading-tight">"{unit.courseOutcome}"</p>
                                  </div>
                                </div>
                              ))}
                              {(!sub.units || sub.units.length === 0) && (
                                <div className="py-20 text-center text-muted-foreground italic border-2 border-dashed rounded-3xl opacity-50 bg-white">
                                  Content pattern awaiting BoS synchronization.
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="lg:col-span-4 space-y-10 border-l pl-10">
                             <div className="space-y-8">
                               <div className="space-y-4">
                                 <h4 className="font-headline font-black text-sm uppercase text-primary tracking-widest border-l-4 border-primary pl-3">Standard Text Books</h4>
                                 <ul className="grid gap-3">
                                   {sub.textBooks?.map((b, i) => (
                                     <li key={i} className="flex gap-3 text-xs text-muted-foreground font-medium bg-muted/10 p-3 rounded-xl border border-muted">
                                       <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                       {b}
                                     </li>
                                   ))}
                                   {(!sub.textBooks || sub.textBooks.length === 0) && <li className="text-[11px] text-muted-foreground italic">Standard registry to be defined.</li>}
                                 </ul>
                               </div>
                               <div className="space-y-4">
                                 <h4 className="font-headline font-black text-sm uppercase text-primary tracking-widest border-l-4 border-primary pl-3">Reference Materials</h4>
                                 <ul className="grid gap-3">
                                   {sub.referenceBooks?.map((b, i) => (
                                     <li key={i} className="flex gap-3 text-xs text-muted-foreground font-medium bg-muted/10 p-3 rounded-xl border border-muted">
                                       <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                                       {b}
                                     </li>
                                   ))}
                                   {(!sub.referenceBooks || sub.referenceBooks.length === 0) && <li className="text-[11px] text-muted-foreground italic">Supplementary records to be defined.</li>}
                                 </ul>
                               </div>
                             </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="feedback" className="pb-20">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-8">
                  <div className="lg:col-span-5 space-y-8">
                    <div className="space-y-4">
                      <h3 className="text-4xl font-headline font-black text-primary leading-tight">Pedagogical Observations</h3>
                      <p className="text-lg text-muted-foreground leading-relaxed">Your feedback directly influences the quality of the next **Board of Studies (BoS)** revision cycle.</p>
                    </div>
                    
                    <div className="grid gap-4">
                      <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border shadow-sm">
                        <div className="p-2 bg-primary/5 rounded-lg text-primary"><CheckCircle2 className="w-5 h-5" /></div>
                        <div>
                          <h4 className="font-black text-sm text-foreground/90">Technical Accuracy</h4>
                          <p className="text-xs text-muted-foreground font-medium mt-0.5">Report unit topic inconsistencies.</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 bg-primary text-white rounded-[2rem] space-y-4 shadow-2xl shadow-primary/20">
                       <div className="flex items-center gap-3 font-black uppercase text-xs tracking-widest opacity-80">
                         <ShieldCheck className="w-6 h-6" /> Quality Assurance Protocol
                       </div>
                       <p className="text-sm font-medium leading-relaxed">
                         Observations submitted here are indexed and presented to the respective **Committee Convenors** during official auditing sessions.
                       </p>
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden bg-white">
                      <CardHeader className="bg-primary/5 border-b py-8 px-10">
                        <CardTitle className="text-xl flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg"><MessageSquare className="w-5 h-5 text-primary" /></div>
                          Submit Technical Observation
                        </CardTitle>
                        <CardDescription className="font-bold">Provide your details to register official curriculum feedback.</CardDescription>
                      </CardHeader>
                      <CardContent className="p-10 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <User className="w-3.5 h-3.5" /> Full Name
                            </Label>
                            <Input value={feedbackForm.name} onChange={e => setFeedbackForm({...feedbackForm, name: e.target.value})} placeholder="Prof. Academic Name" className="h-12 border-primary/10 focus:ring-primary/20 rounded-xl" />
                          </div>
                          <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                              <Mail className="w-3.5 h-3.5" /> Institutional Email
                            </Label>
                            <Input value={feedbackForm.email} onChange={e => setFeedbackForm({...feedbackForm, email: e.target.value})} placeholder="email@rtu.ac.in" className="h-12 border-primary/10 focus:ring-primary/20 rounded-xl" />
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Phone className="w-3.5 h-3.5" /> Contact Number
                          </Label>
                          <Input value={feedbackForm.phone} onChange={e => setFeedbackForm({...feedbackForm, phone: e.target.value})} placeholder="+91 XXXX XXX XXX" className="h-12 border-primary/10 rounded-xl" />
                        </div>
                        <div className="space-y-3">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <MessageSquare className="w-3.5 h-3.5" /> Technical Feedback / Recommendation
                          </Label>
                          <Textarea 
                            value={feedbackForm.feedback} 
                            onChange={e => setFeedbackForm({...feedbackForm, feedback: e.target.value})} 
                            placeholder="Identify specific unit titles or outcome improvements..."
                            className="min-h-[180px] border-primary/10 rounded-2xl p-6 leading-relaxed"
                          />
                        </div>
                        <Button className="w-full h-14 gap-3 text-lg font-black shadow-xl shadow-primary/20 rounded-2xl group" onClick={handleSubmitFeedback} disabled={isSubmittingFeedback}>
                          {isSubmittingFeedback ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                          Register Technical Observation
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-40 space-y-8">
            <div className="h-28 w-28 bg-primary/5 rounded-full flex items-center justify-center border-2 border-dashed border-primary/20">
               <BookOpen className="w-14 h-14 text-primary opacity-20" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-headline font-black text-primary">Awaiting Institutional Parameters</h3>
              <p className="text-muted-foreground font-medium max-w-sm">Choose a program, branch, and batch from the discovery engine above to view official records.</p>
            </div>
          </div>
        )}
      </main>

      <footer className="py-20 border-t bg-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        <div className="max-w-7xl mx-auto px-8 text-center space-y-6">
          <div className="flex justify-center mb-6">
             {rtuLogo && (
               <Image 
                 src={rtuLogo.imageUrl} 
                 alt="RTU Logo" 
                 width={60} 
                 height={60} 
                 className="object-contain" 
                 unoptimized
                 data-ai-hint="RTU Logo" 
               />
             )}
          </div>
          <p className="text-[11px] text-muted-foreground uppercase font-black tracking-[0.5em]">Rajasthan Technical University, Kota</p>
        </div>
      </footer>
    </div>
  );
}
