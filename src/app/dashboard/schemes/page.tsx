
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, serverTimestamp, query, orderBy, getDoc, writeBatch } from 'firebase/firestore';
import { Scheme, Program, UserProfile, CreditCategory, Syllabus, SubjectType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Loader2, Calendar, FileText, ArrowRight, ShieldCheck, Hash, Trash2, ChevronLeft, GraduationCap } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

interface SlotConfig {
  id: string;
  semester: number;
  creditCategory: CreditCategory;
  credits: number;
  type: SubjectType;
  lectureCredits: number;
  tutorialCredits: number;
  practicalCredits: number;
  isInherited?: boolean;
  subjectCode?: string;
  title?: string;
}

export default function SchemesPage() {
  const db = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const schemesQuery = useMemoFirebase(() => {
    return query(collection(db, 'schemes'), orderBy('updatedAt', 'desc'));
  }, [db]);

  const { data: schemes, loading: schemesLoading } = useCollection<Scheme>(schemesQuery);
  
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs } = useCollection<Program>(programsRef);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [step, setStep] = useState(1);
  const [newScheme, setNewScheme] = useState({
    programId: '',
    branch: '',
    batchYear: '',
    version: 'v1.0'
  });

  const [semesterSlots, setSemesterSlots] = useState<SlotConfig[]>([]);

  const isCommonBos = profile?.faculty === 'University-wide (Common BOS)';
  const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile?.role || '');
  const isMonitor = profile?.role === 'monitor';

  const calculateCredits = (l: number, t: number, p: number) => {
    let total = l + t;
    if (p > 0) {
      total += (p === 3 ? 2 : p / 2);
    }
    return Number(total.toFixed(2));
  };

  const visibleCategories = useMemo(() => {
    const all = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'] as CreditCategory[];
    if (isGlobalAdmin) return all;

    if (isCommonBos) {
      return all.filter(c => !['DSC', 'DSE', 'PRJ'].includes(c));
    } else {
      return all.filter(c => !['AEC', 'VAC', 'MDC'].includes(c));
    }
  }, [isCommonBos, isGlobalAdmin]);

  const filteredSchemes = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_academic' || profile.role === 'monitor') {
      return schemes;
    }
    if (isCommonBos) return schemes;
    if (profile.role === 'dean_faculty') {
      return schemes.filter(s => {
        const prog = programs.find(p => p.id === s.programId);
        return prog?.faculty === profile.faculty;
      });
    }
    const managed = profile.managedBranches || [];
    return schemes.filter(s => 
      s.isCommonPoolScheme || 
      managed.some(m => m.programId === s.programId && m.branch === s.branch)
    );
  }, [schemes, profile, programs, isCommonBos]);

  const availablePrograms = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_academic' || isCommonBos || isMonitor) return programs;
    if (profile.role === 'dean_faculty') return programs.filter(p => p.faculty === profile.faculty);
    const managedProgramIds = new Set(profile.managedBranches?.map(b => b.programId) || []);
    return programs.filter(p => managedProgramIds.has(p.id));
  }, [programs, profile, isCommonBos, isMonitor]);

  const selectedProgram = programs.find(p => p.id === newScheme.programId);

  useEffect(() => {
    if (selectedProgram && step === 2) {
      const template = selectedProgram.slotTemplate || [];
      const inheritedSlots: SlotConfig[] = template.map(t => ({
        id: t.id,
        semester: t.semester,
        creditCategory: t.creditCategory || 'DSC',
        credits: t.credits,
        type: t.type || 'Theory',
        lectureCredits: t.lectureCredits || 0,
        tutorialCredits: t.tutorialCredits || 0,
        practicalCredits: t.practicalCredits || 0,
        subjectCode: t.subjectCode || '',
        title: t.title || '',
        isInherited: true
      }));
      setSemesterSlots(inheritedSlots);
    }
  }, [selectedProgram, step]);

  const handleAddSlot = (semester: number) => {
    const newSlot: SlotConfig = {
      id: Math.random().toString(36).substr(2, 9),
      semester,
      creditCategory: isCommonBos ? 'VAC' : 'DSE',
      credits: 4,
      type: 'Theory',
      lectureCredits: 4,
      tutorialCredits: 0,
      practicalCredits: 0,
      isInherited: false,
      subjectCode: '',
      title: isCommonBos ? '' : (isCommonBos ? 'Institutional Pool' : 'Elective Group')
    };
    setSemesterSlots([...semesterSlots, newSlot]);
  };

  const removeSlot = (id: string) => setSemesterSlots(semesterSlots.filter(s => s.id !== id));
  
  const updateSlot = (id: string, updates: Partial<SlotConfig>) => {
    setSemesterSlots(semesterSlots.map(s => {
      if (s.id === id) {
        const updated = { ...s, ...updates };
        const l = Number(updated.lectureCredits) || 0;
        const t = Number(updated.tutorialCredits) || 0;
        const p = Number(updated.practicalCredits) || 0;
        updated.credits = calculateCredits(l, t, p);
        return updated;
      }
      return s;
    }));
  };

  const handleCreateScheme = async () => {
    if (!newScheme.programId || !newScheme.batchYear) {
      toast({ title: "Validation Error", description: "Program and Batch are required.", variant: "destructive" });
      return;
    }
    if (!selectedProgram) return;
    setIsCreating(true);

    const branchName = isCommonBos ? 'Institutional Common Pool' : newScheme.branch;
    let branchPrefix = isCommonBos ? 'GN' : (selectedProgram.branchPrefixes?.[branchName]);
    
    if (!branchPrefix && !isCommonBos) {
      const lowerBranch = branchName.toLowerCase();
      branchPrefix = lowerBranch.includes('production') && lowerBranch.includes('industrial') ? 'PI' : branchName.substring(0, 2).toUpperCase();
    }
    
    const creationYear = new Date().getFullYear();
    const shortPrefix = branchPrefix === 'GN' ? 'POOL' : (branchPrefix || 'GEN');
    const generatedCode = `${selectedProgram.code}-${shortPrefix}-${creationYear}`;
    const schemeDocRef = doc(db, 'schemes', generatedCode);
    
    try {
      const existingDoc = await getDoc(schemeDocRef);
      if (existingDoc.exists()) {
        toast({ title: "Conflict", description: `Scheme ${generatedCode} already exists.`, variant: "destructive" });
        setIsCreating(false);
        return;
      }

      await setDoc(schemeDocRef, {
        ...newScheme,
        id: generatedCode,
        branch: branchName,
        schemeCode: generatedCode,
        status: 'Draft',
        createdBy: user?.uid || '',
        hasMultipleExits: false,
        abcEnabled: true,
        exitOptions: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isCommonPoolScheme: isCommonBos,
      });

      const batch = writeBatch(db);
      const counters: Record<string, number> = { DSC: 0, SEC: 0, DSE: 0, PRJ: 0, AEC: 0, MDC: 0, VAC: 0, OFE: 0 };

      semesterSlots.forEach(slot => {
        const cat = slot.creditCategory;
        
        // Institutional Rule: Prefix Determination
        let prefix = branchPrefix || 'GEN';
        if (cat === 'AEC') prefix = 'AE';
        else if (cat === 'MDC') prefix = 'MD';
        else if (cat === 'VAC') prefix = 'VA';
        
        counters[cat]++;
        const seq = counters[cat];
        
        // Institutional Rule: Pedagogy determination
        let pedagogy = 'L'; // Default: Lecture
        if (cat === 'PRJ') pedagogy = 'I'; // Internship/Project
        else if (slot.type === 'Lab/Sessional' || slot.title?.toLowerCase().includes('lab') || slot.title?.toLowerCase().includes('practical')) pedagogy = 'P';
        
        // Institutional Rule: Pillar determination
        const pillar = ['DSE', 'OFE'].includes(cat) ? 'E' : 'C'; // Elective or Core
        
        // Institutional Rule: Year determination
        const year = Math.ceil(slot.semester / 2);
        
        // Institutional Rule: 7-Character Composite Code
        const baseAutoCode = `${prefix.substring(0,2)}${pedagogy}${pillar}${year}${String(seq).padStart(2, '0')}`;
        const finalCode = slot.subjectCode || baseAutoCode;

        if (cat === 'DSE' || cat === 'OFE') {
          for (let i = 1; i <= 3; i++) {
            const optionId = `SLOT-${cat}-${slot.semester}-${slot.id}-${i}`;
            const optionRef = doc(db, 'schemes', generatedCode, 'syllabi', optionId);
            const optionCode = `${finalCode}.${i}`;
            
            const data: any = {
              id: optionId,
              schemeId: generatedCode,
              subjectCode: optionCode,
              semester: slot.semester,
              creditCategory: cat,
              credits: slot.credits,
              title: `${slot.title || (cat === 'DSE' ? 'Elective' : 'Open Elective')} - Subject ${i}`,
              isSlot: true,
              isOFESlot: cat === 'OFE',
              type: slot.type,
              lectureCredits: slot.lectureCredits,
              tutorialCredits: slot.tutorialCredits,
              practicalCredits: slot.practicalCredits,
              units: [],
              poMappings: {},
              prerequisites: [],
              courseOutcomes: [],
              textBooks: [],
              referenceBooks: [],
              electiveGroupId: slot.title || (cat === 'DSE' ? 'Elective Group' : 'Open Elective Group')
            };
            batch.set(optionRef, data);
          }
        } else {
          const slotId = `SLOT-${cat}-${slot.semester}-${slot.id}`;
          const slotRef = doc(db, 'schemes', generatedCode, 'syllabi', slotId);
          
          const data: any = {
            id: slotId,
            schemeId: generatedCode,
            subjectCode: finalCode,
            semester: slot.semester,
            creditCategory: cat,
            credits: slot.credits,
            title: slot.title || `${cat} Slot`,
            isSlot: true,
            isOFESlot: cat === 'OFE',
            type: slot.type,
            lectureCredits: slot.lectureCredits,
            tutorialCredits: slot.tutorialCredits,
            practicalCredits: slot.practicalCredits,
            units: [],
            poMappings: {},
            prerequisites: [],
            courseOutcomes: [],
            textBooks: [],
            referenceBooks: []
          };
          
          if (cat === 'OFE' && slot.title) {
            data.electiveGroupId = slot.title;
          }
          
          batch.set(slotRef, data);
        }
      });

      await batch.commit();
      toast({ title: "Success", description: "Scheme architecture initialized." });
      setIsDialogOpen(false);
      router.push(`/dashboard/schemes/${generatedCode}`);
    } catch (error) {
      console.error("Error creating scheme:", error);
      toast({ title: "Error", description: "Initialization failed.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (schemesLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const canCreateScheme = profile?.role === 'admin' || profile?.role === 'dean_academic';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Academic Schemes</h1>
          <p className="text-muted-foreground">{isCommonBos ? 'Developing common course schemes for university-wide rollout.' : 'Draft, build, and manage branch-specific academic layouts.'}</p>
        </div>
        {canCreateScheme && (
          <Button onClick={() => { setStep(1); setIsDialogOpen(true); setNewScheme({programId: '', branch: '', batchYear: '', version: 'v1.0'}); setSemesterSlots([]); }} className="gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> {isCommonBos ? 'Define Common Pool' : 'New Scheme'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchemes.map((scheme) => {
          const program = programs.find(p => p.id === scheme.programId);
          return (
            <Card key={scheme.id} className={`hover:shadow-md transition-shadow group relative overflow-hidden ${scheme.isCommonPoolScheme ? 'border-emerald-200 bg-emerald-50/20' : ''}`}>
              {scheme.isCommonPoolScheme && (
                <div className="absolute top-0 right-0 p-2 flex items-center gap-1">
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-[8px] uppercase font-bold">Institutional Pool</Badge>
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
              )}
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[10px]">{scheme.version}</Badge>
                  <StatusBadge status={scheme.status} />
                </div>
                <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors flex items-center gap-2">{program?.name || 'Loading...'}</CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-primary font-bold"><Hash className="w-3 h-3" /> {scheme.schemeCode}</div>
                  <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /><span className={scheme.isCommonPoolScheme ? 'font-bold text-emerald-700' : ''}>{scheme.branch || 'General'}</span></div>
                  <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /><span>Batch: {scheme.batchYear}</span></div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-white" asChild>
                  <Link href={`/dashboard/schemes/${scheme.id}`}>Manage Layout <ArrowRight className="w-4 h-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {filteredSchemes.length === 0 && (
          <div className="col-span-full py-20 text-center border border-dashed rounded-xl bg-muted/20">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-muted-foreground">No authorized schemes found for your jurisdiction.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={step === 2 ? "max-w-5xl" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle>{step === 1 ? (isCommonBos ? 'Define Common Pool' : 'Create New Scheme') : 'Institutional Slot Architect'}</DialogTitle>
            <DialogDescription>{step === 1 ? 'Step 1: Define academic identity.' : 'Step 2: Inherit and refine standard slots.'}</DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Academic Program</Label>
                <Select onValueChange={(v) => setNewScheme({...newScheme, programId: v, branch: ''})}>
                  <SelectTrigger><SelectValue placeholder="Select program..." /></SelectTrigger>
                  <SelectContent>{availablePrograms.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {!isCommonBos && selectedProgram?.branches?.length ? (
                <div className="space-y-2">
                  <Label>Branch / Specialization</Label>
                  <Select value={newScheme.branch} onValueChange={(v) => setNewScheme({...newScheme, branch: v})}>
                    <SelectTrigger><SelectValue placeholder="Select branch..." /></SelectTrigger>
                    <SelectContent>{selectedProgram.branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Batch Year</Label>
                <Input placeholder="e.g., 2024-28" value={newScheme.batchYear} onChange={(e) => setNewScheme({...newScheme, batchYear: e.target.value})} />
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-[10px] text-amber-800 flex gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <p>Note: DSE/OFE slots will be expanded into 3 subject options automatically during scheme creation.</p>
              </div>
              <ScrollArea className="h-[400px] pr-4">
                {Array.from({ length: selectedProgram?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => (
                  <div key={sem} className="mb-6 border rounded-xl p-4 bg-muted/20">
                    <div className="flex items-center justify-between mb-4"><h4 className="font-headline font-bold text-sm">Semester {sem}</h4><Button variant="outline" size="sm" onClick={() => handleAddSlot(sem)} className="h-8 gap-2"><Plus className="w-3.5 h-3.5" /> Add Slot</Button></div>
                    <div className="space-y-4">
                      {semesterSlots.filter(s => s.semester === sem).map(slot => (
                        <div key={slot.id} className="grid grid-cols-12 gap-3 items-end border-b pb-4 last:border-0 last:pb-0">
                          <div className="col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Category</Label><Select disabled={slot.isInherited} value={slot.creditCategory} onValueChange={(v: CreditCategory) => updateSlot(slot.id, { creditCategory: v })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{visibleCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></div>
                          <div className="col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Method</Label><Select disabled={slot.isInherited} value={slot.type} onValueChange={(v: SubjectType) => updateSlot(slot.id, { type: v })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Theory">Theory</SelectItem><SelectItem value="Lab/Sessional">Lab</SelectItem></SelectContent></Select></div>
                          
                          {slot.type === 'Theory' ? (
                            <>
                              <div className="col-span-1 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">L</Label><Input disabled={slot.isInherited} type="number" value={slot.lectureCredits} onChange={e => updateSlot(slot.id, { lectureCredits: Number(e.target.value) })} className="h-9" /></div>
                              <div className="col-span-1 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">T</Label><Input disabled={slot.isInherited} type="number" value={slot.tutorialCredits} onChange={e => updateSlot(slot.id, { tutorialCredits: Number(e.target.value) })} className="h-9" /></div>
                            </>
                          ) : (
                            <div className="col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">P</Label><Input disabled={slot.isInherited} type="number" value={slot.practicalCredits} onChange={e => updateSlot(slot.id, { practicalCredits: Number(e.target.value) })} className="h-9" /></div>
                          )}

                          <div className="col-span-1 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Cr</Label><div className="h-9 flex items-center justify-center bg-white border rounded text-[10px] font-bold">{slot.credits}</div></div>
                          <div className="col-span-2 space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Code</Label><Input disabled={slot.isInherited} value={slot.subjectCode || ''} onChange={e => updateSlot(slot.id, { subjectCode: e.target.value.toUpperCase() })} className="h-9" /></div>
                          <div className="col-span-2 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                              {['DSE', 'OFE'].includes(slot.creditCategory) ? 'Group Identity' : 'Title'}
                            </Label>
                            <Input disabled={slot.isInherited} value={slot.title || ''} onChange={e => updateSlot(slot.id, { title: e.target.value })} className="h-9" />
                          </div>
                          <div className="col-span-1 pb-0.5">{!slot.isInherited && <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400" onClick={() => removeSlot(slot.id)}><Trash2 className="w-4 h-4" /></Button>}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            {step === 1 ? <Button onClick={() => setStep(2)} disabled={!newScheme.programId || !newScheme.batchYear}>Configure Slots <ArrowRight className="w-4 h-4 ml-2" /></Button> : <div className="flex gap-2"><Button variant="ghost" onClick={() => setStep(1)}><ChevronLeft className="w-4 h-4 mr-2" /> Back</Button><Button onClick={handleCreateScheme} disabled={isCreating}>{isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GraduationCap className="w-4 h-4 mr-2" />}Initialize Scheme</Button></div>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: any = { 'Draft': 'bg-slate-100 text-slate-700', 'Pending Dean': 'bg-amber-100 text-amber-700', 'Pending Academics': 'bg-blue-100 text-blue-700', 'Approved': 'bg-emerald-100 text-emerald-700' };
  return <Badge variant="secondary" className={`${colors[status] || ''} border-none font-medium text-[10px]`}>{status}</Badge>;
}
