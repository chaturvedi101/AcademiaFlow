'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, serverTimestamp, query, orderBy, getDoc, writeBatch, collectionGroup, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Scheme, Program, UserProfile, CreditCategory, Syllabus, SubjectType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Loader2, Calendar, FileText, ArrowRight, ShieldCheck, Hash, Trash2, ChevronLeft, GraduationCap, Building2, Info, AlertTriangle } from 'lucide-react';
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
  electiveGroupId?: string;
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
  const isAdmin = profile?.role === 'admin';

  const calculateCredits = (l: number, t: number, p: number) => {
    if (p > 0) {
      if (p === 1) return 0.5;
      if (p === 2) return 1.0;
      if (p === 3) return 2.0;
      if (p === 4) return 2.0;
      return Number((p / 2).toFixed(2));
    }
    return l + t;
  };

  const filteredSchemes = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_academic' || profile.role === 'monitor' || isCommonBos) return schemes;
    if (profile.role === 'dean_faculty') return schemes.filter(s => programs.find(p => p.id === s.programId)?.faculty === profile.faculty);
    const managed = profile.managedBranches || [];
    return schemes.filter(s => s.isCommonPoolScheme || managed.some(m => m.programId === s.programId && m.branch === s.branch));
  }, [schemes, profile, programs, isCommonBos]);

  const availablePrograms = useMemo(() => {
    if (!profile) return [];
    if (isGlobalAdmin || isCommonBos) return programs;
    if (profile.role === 'dean_faculty') return programs.filter(p => p.faculty === profile.faculty);
    const managedIds = new Set(profile.managedBranches?.map(b => b.programId) || []);
    return programs.filter(p => managedIds.has(p.id));
  }, [programs, profile, isGlobalAdmin, isCommonBos]);

  const selectedProgram = programs.find(p => p.id === newScheme.programId);

  useEffect(() => {
    if (selectedProgram && step === 2) {
      const template = selectedProgram.slotTemplate || [];
      setSemesterSlots(template.map(t => ({
        ...t,
        isInherited: true
      })));
    }
  }, [selectedProgram, step]);

  const updateSlot = (id: string, updates: Partial<SlotConfig>) => {
    setSemesterSlots(prev => prev.map(s => {
      if (s.id === id) {
        let updated = { ...s, ...updates };
        if (updates.type === 'Theory') updated.practicalCredits = 0;
        else if (updates.type === 'Lab/Sessional') { updated.lectureCredits = 0; updated.tutorialCredits = 0; }
        updated.credits = calculateCredits(Number(updated.lectureCredits)||0, Number(updated.tutorialCredits)||0, Number(updated.practicalCredits)||0);
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
    const branchPrefix = isCommonBos ? 'GN' : (selectedProgram.branchPrefixes?.[branchName] || branchName.substring(0, 2).toUpperCase());
    
    const creationYear = new Date().getFullYear();
    const generatedCode = `${selectedProgram.code}-${branchPrefix}-${creationYear}`;
    const schemeRef = doc(db, 'schemes', generatedCode);
    
    try {
      const existing = await getDoc(schemeRef);
      if (existing.exists()) {
        toast({ title: "Conflict", description: `Scheme ${generatedCode} already exists.`, variant: "destructive" });
        setIsCreating(false);
        return;
      }

      const allSyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      const globalUsedCodes = new Set(allSyllabiSnap.docs.map(d => d.data().subjectCode as string));

      await setDoc(schemeRef, {
        ...newScheme,
        id: generatedCode,
        branch: branchName,
        schemeCode: generatedCode,
        status: 'Draft',
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isCommonPoolScheme: isCommonBos,
        version: newScheme.version || 'v1.0'
      });

      const batch = writeBatch(db);
      const usedSuffixesInScheme = new Map<number, Set<string>>();

      for (const slot of semesterSlots) {
        const cat = slot.creditCategory;
        const pedagogy = slot.type === 'Lab/Sessional' ? 'P' : (cat === 'PRJ' ? 'I' : 'L');
        
        let pillar = 'C';
        if (cat === 'DSE' || cat === 'OFE') pillar = 'E';
        else if (cat === 'SEC') pillar = 'S';
        else if (cat === 'VAC') pillar = 'V';
        else if (cat === 'AEC') pillar = 'A';
        else if (cat === 'MDC') pillar = 'M';
        else if (cat === 'PRJ') pillar = 'P';

        const year = Math.ceil(slot.semester / 2);
        if (!usedSuffixesInScheme.has(year)) usedSuffixesInScheme.set(year, new Set());

        const generateUniqueCode = (baseBranch: string) => {
          let sequence = 1;
          let finalCode = '';
          const yearSet = usedSuffixesInScheme.get(year)!;

          while (sequence < 100) {
            const seqStr = String(sequence).padStart(2, '0');
            const suffix = `${year}${seqStr}`;
            
            // Check if this suffix is already assigned to this branch globally
            const globalConflict = Array.from(globalUsedCodes).some(code => 
              code.startsWith(baseBranch) && (code.endsWith(suffix) || code.includes(suffix + '.'))
            );

            if (!yearSet.has(seqStr) && !globalConflict) {
              finalCode = `${baseBranch}${pedagogy}${pillar}${suffix}`;
              yearSet.add(seqStr);
              break;
            }
            sequence++;
          }
          if (!finalCode) throw new Error(`Suffix range exhausted for Year ${year} in Branch ${baseBranch}`);
          return finalCode;
        };

        const isElective = !['DSC', 'PRJ', 'SEC'].includes(cat);
        const baseUniqueCode = generateUniqueCode(branchPrefix);
        const sharedGroupId = slot.electiveGroupId || `G-${slot.id}`;

        if (isElective) {
          // Provision 3 options for elective slots
          for (let i = 1; i <= 3; i++) {
            const optionCode = `${baseUniqueCode}.${i}`;
            const slotId = `SLOT-${cat}-${slot.semester}-${slot.id}-${i}`;
            const slotRef = doc(db, 'schemes', generatedCode, 'syllabi', slotId);
            
            batch.set(slotRef, {
              id: slotId,
              schemeId: generatedCode,
              subjectCode: optionCode,
              semester: slot.semester,
              creditCategory: cat,
              credits: slot.credits,
              title: slot.title ? `${slot.title} (Option ${i})` : `${cat} Option ${i}`,
              type: slot.type,
              lectureCredits: slot.lectureCredits,
              tutorialCredits: slot.tutorialCredits,
              practicalCredits: slot.practicalCredits,
              electiveGroupId: sharedGroupId,
              isSlot: true,
              units: [],
              poMappings: {},
              textBooks: [],
              referenceBooks: []
            });
          }
        } else {
          // Standard single core slot
          const slotId = `SLOT-${cat}-${slot.semester}-${slot.id}`;
          const slotRef = doc(db, 'schemes', generatedCode, 'syllabi', slotId);
          
          batch.set(slotRef, {
            id: slotId,
            schemeId: generatedCode,
            subjectCode: baseUniqueCode,
            semester: slot.semester,
            creditCategory: cat,
            credits: slot.credits,
            title: slot.title || `${cat} Slot`,
            type: slot.type,
            lectureCredits: slot.lectureCredits,
            tutorialCredits: slot.tutorialCredits,
            practicalCredits: slot.practicalCredits,
            electiveGroupId: '', // Core slots never have groups
            isSlot: true,
            units: [],
            poMappings: {},
            textBooks: [],
            referenceBooks: []
          });
        }
      }

      await batch.commit();
      toast({ title: "Success", description: "Scheme initialized with automated elective groups." });
      router.push(`/dashboard/schemes/${generatedCode}`);
    } catch (error: any) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteScheme = async (schemeId: string) => {
    if (!window.confirm("Are you sure you want to delete this draft scheme? All course content within this scheme will be permanently removed. This action cannot be undone.")) {
      return;
    }

    try {
      const schemeRef = doc(db, 'schemes', schemeId);
      await deleteDoc(schemeRef);
      toast({ title: "Scheme Deleted", description: "Institutional record removed successfully." });
    } catch (error: any) {
      toast({ title: "Deletion Failed", description: error.message, variant: "destructive" });
    }
  };

  if (schemesLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Academic Schemes</h1>
          <p className="text-muted-foreground">Manage institutional curriculum layouts with automated coding logic.</p>
        </div>
        {(isGlobalAdmin || isCommonBos) && (
          <Button onClick={() => { setStep(1); setIsDialogOpen(true); }} className="gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> {isCommonBos ? 'Define Common Pool' : 'New Scheme'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchemes.map((scheme) => (
          <Card key={scheme.id} className={`hover:shadow-md transition-shadow group relative overflow-hidden ${scheme.isCommonPoolScheme ? 'border-emerald-200 bg-emerald-50/20' : ''}`}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[10px]">{scheme.version}</Badge>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-700 border-none font-medium text-[10px]">{scheme.status}</Badge>
                  {isAdmin && scheme.status === 'Draft' && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                      onClick={() => handleDeleteScheme(scheme.id)}
                      title="Delete Draft Scheme"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors">{programs.find(p => p.id === scheme.programId)?.name || 'Loading...'}</CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-mono text-[10px] text-primary font-bold"><Hash className="w-3 h-3" /> {scheme.schemeCode}</div>
                <div className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /><span>{scheme.branch || 'General'}</span></div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-white" asChild>
                <Link href={`/dashboard/schemes/${scheme.id}`}>Manage Layout <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {filteredSchemes.length === 0 && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-3xl border border-dashed">
            <BookOpen className="w-12 h-12 mb-4 opacity-20" />
            <p className="font-medium">No active schemes found.</p>
            <p className="text-xs">Initialize a new scheme from the Program Catalog to begin.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={step === 2 ? "max-w-5xl" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle>{step === 1 ? 'Academic Identity' : 'Institutional Code Resolution'}</DialogTitle>
            <DialogDescription>
              {step === 1 ? 'Select the program framework to instantiate a new curriculum scheme.' : 'Review auto-generated codes for template slots. Electives will automatically generate 3 options.'}
            </DialogDescription>
          </DialogHeader>

          {step === 1 ? (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-bold">1. Select Academic Program</Label>
                <Select onValueChange={(v) => setNewScheme({...newScheme, programId: v, branch: ''})}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Select program..." /></SelectTrigger>
                  <SelectContent>
                    {availablePrograms.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProgram && (
                <>
                  <div className="space-y-2 p-4 bg-muted/30 rounded-lg border border-dashed animate-in fade-in slide-in-from-top-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">2. Assigned Faculty (System Locked)</Label>
                    <p className="text-sm font-semibold text-primary">{selectedProgram.faculty}</p>
                  </div>

                  {!isCommonBos && selectedProgram?.branches?.length ? (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-sm font-bold">3. Select Specialization / Branch</Label>
                      <Select value={newScheme.branch} onValueChange={(v) => setNewScheme({...newScheme, branch: v})}>
                        <SelectTrigger className="h-12"><SelectValue placeholder="Select branch..." /></SelectTrigger>
                        <SelectContent>
                          {selectedProgram.branches.map(b => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                    <Label className="text-sm font-bold">4. Batch Year</Label>
                    <Input 
                      placeholder="e.g., 2024-28" 
                      className="h-12"
                      value={newScheme.batchYear} 
                      onChange={(e) => setNewScheme({...newScheme, batchYear: e.target.value})} 
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="py-4 space-y-6">
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-[11px] text-primary flex gap-3">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <p><b>Auto-Coding Policy:</b> Branch Code replaces XX pattern. Suffixes (e.g., 101, 102) are audited for global uniqueness within the Branch. Sessional/Lab slots use 'P' pedagogy. <b>Elective slots provision three sub-options (.1, .2, .3).</b></p>
              </div>
              
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-blue-800 text-[10px]">
                <Info className="w-4 h-4 shrink-0" />
                <p>If a semester appears empty here, it means no branch-specific subjects are defined in the master template. Only Common Pool subjects (AEC/VAC/MDC) will appear in the final scheme for those semesters.</p>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                {Array.from({ length: selectedProgram?.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                  const slotsInSem = semesterSlots.filter(s => s.semester === sem);
                  return (
                    <div key={sem} className="mb-6 border rounded-xl p-4 bg-muted/20">
                      <h4 className="font-headline font-bold text-sm mb-4 flex items-center justify-between">
                         Semester {sem}
                         {slotsInSem.length === 0 && <span className="text-[10px] font-normal text-muted-foreground italic">(No branch patterns defined)</span>}
                      </h4>
                      <div className="space-y-4">
                        {slotsInSem.map(slot => (
                          <div key={slot.id} className="grid grid-cols-12 gap-3 items-end border-b pb-4 last:border-0 last:pb-0">
                            <div className="col-span-2"><Label className="text-[10px] uppercase font-bold">Category</Label><div className="h-9 flex items-center px-3 bg-white border rounded text-[10px]">{slot.creditCategory}</div></div>
                            <div className="col-span-2"><Label className="text-[10px] uppercase font-bold">Method</Label><div className="h-9 flex items-center px-3 bg-white border rounded text-[10px]">{slot.type}</div></div>
                            <div className="col-span-1"><Label className="text-[10px] uppercase font-bold">Credits</Label><div className="h-9 flex items-center justify-center bg-white border rounded text-[10px] font-bold">{slot.credits}</div></div>
                            <div className="col-span-2"><Label className="text-[10px] uppercase font-bold">Group ID</Label><div className="h-9 flex items-center px-3 bg-white border rounded text-[10px]">{slot.electiveGroupId || '-'}</div></div>
                            <div className="col-span-2"><Label className="text-[10px] uppercase font-bold">Code Pattern</Label><div className="h-9 flex items-center px-3 bg-muted border rounded text-[10px] font-mono">{slot.subjectCode?.replace('XX', 'BRANCH')}</div></div>
                            <div className="col-span-3"><Label className="text-[10px] uppercase font-bold">Title</Label><Input value={slot.title || ''} onChange={e => updateSlot(slot.id, { title: e.target.value })} className="h-9" /></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            {step === 1 ? (
              <Button onClick={() => setStep(2)} disabled={!newScheme.programId || !newScheme.batchYear}>
                Verify Suffixes <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => { setStep(1); setSemesterSlots([]); }}>Back</Button>
                <Button onClick={handleCreateScheme} disabled={isCreating}>
                  {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <GraduationCap className="w-4 h-4 mr-2" />}
                  Instantiate Scheme
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
