'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, serverTimestamp, query, orderBy, getDoc, writeBatch, collectionGroup, getDocs, deleteDoc } from 'firebase/firestore';
import { Scheme, Program, UserProfile, CreditCategory, SubjectType } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Loader2, FileText, ArrowRight, ShieldCheck, Hash, Trash2, GraduationCap, Info, Layers, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
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
    programIds: [] as string[],
    branch: '',
    batchYear: '',
    version: 'v1.0',
    isInstitutional: false,
    poolVertical: '' as 'B.Tech' | 'BBA' | ''
  });

  const [semesterSlots, setSemesterSlots] = useState<SlotConfig[]>([]);

  const isCommonBos = profile?.faculty ? profile.faculty.includes('(Common BOS)') : false;
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
    if (!profile || !programs.length) return [];
    if (profile.role === 'admin' || profile.role === 'dean_academic' || profile.role === 'monitor') return schemes;
    
    if (isCommonBos) {
      const isBTechBOS = profile.faculty === 'B.Tech (Common BOS)';
      const isBBABOS = profile.faculty === 'BBA (Common BOS)';

      return schemes.filter(s => {
        const prog = programs.find(p => p.id === s.programId);
        if (isBTechBOS) return (prog?.faculty.includes('Engineering')) || (s.isCommonPoolScheme && s.branch === 'B.Tech (Common BOS) Pool');
        if (isBBABOS) return (prog?.faculty.includes('Management') || prog?.name.includes('BBA')) || (s.isCommonPoolScheme && s.branch === 'BBA (Common BOS) Pool');
        return false;
      });
    }

    if (profile.role === 'dean_faculty') return schemes.filter(s => programs.find(p => p.id === s.programId)?.faculty === profile.faculty);
    
    const managed = profile.managedBranches || [];
    const isManagementVertical = managed.some(m => {
      const p = programs.find(prog => prog.id === m.programId);
      return p?.faculty.includes('Management') || p?.name.includes('BBA');
    });

    const targetPoolName = isManagementVertical ? 'BBA (Common BOS) Pool' : 'B.Tech (Common BOS) Pool';

    return schemes.filter(s => 
      (s.isCommonPoolScheme && s.branch === targetPoolName) || 
      managed.some(m => m.programId === s.programId && m.branch === s.branch)
    );
  }, [schemes, profile, programs, isCommonBos]);

  const availablePrograms = useMemo(() => {
    if (!profile) return [];
    if (isGlobalAdmin) return programs;
    
    if (isCommonBos) {
       const isBTechBOS = profile.faculty === 'B.Tech (Common BOS)';
       const isBBABOS = profile.faculty === 'BBA (Common BOS)';
       return programs.filter(p => {
         if (isBTechBOS) return p.faculty.includes('Engineering');
         if (isBBABOS) return p.faculty.includes('Management') || p.name.includes('BBA');
         return false;
       });
    }

    if (profile.role === 'dean_faculty') return programs.filter(p => p.faculty === profile.faculty);
    const managedIds = new Set(profile.managedBranches?.map(b => b.programId) || []);
    return programs.filter(p => managedIds.has(p.id));
  }, [programs, profile, isGlobalAdmin, isCommonBos]);

  const templateProgram = programs.find(p => p.id === newScheme.programIds[0]);

  useEffect(() => {
    if (templateProgram && step === 2 && !newScheme.isInstitutional) {
      const template = templateProgram.slotTemplate || [];
      setSemesterSlots(template.map(t => ({
        ...t,
        isInherited: true
      })));
    }
  }, [templateProgram, step, newScheme.isInstitutional]);

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

  const toggleProgram = (pid: string) => {
    setNewScheme(prev => {
      const ids = prev.programIds.includes(pid) 
        ? prev.programIds.filter(id => id !== pid)
        : [...prev.programIds, pid];
      return { ...prev, programIds: ids };
    });
  };

  const handleCreateScheme = async () => {
    if (!newScheme.batchYear) {
      toast({ title: "Validation Error", description: "Batch Year is required.", variant: "destructive" });
      return;
    }

    if (!newScheme.isInstitutional && newScheme.programIds.length === 0) {
      toast({ title: "Validation Error", description: "Select an Academic Program.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);

    try {
      const creationYear = new Date().getFullYear();

      if (newScheme.isInstitutional) {
        // Create ONE blank standalone pool
        const verticalLabel = newScheme.poolVertical || (profile?.faculty?.includes('B.Tech') ? 'B.Tech' : 'BBA');
        const branchName = `${verticalLabel} (Common BOS) Pool`;
        const generatedCode = `${verticalLabel.toUpperCase()}-POOL-${newScheme.batchYear}`;
        
        const schemeRef = doc(db, 'schemes', generatedCode);
        const existing = await getDoc(schemeRef);
        
        if (existing.exists()) {
          throw new Error(`Institutional Pool ${generatedCode} already exists.`);
        }

        await setDoc(schemeRef, {
          programId: 'INSTITUTIONAL',
          branch: branchName,
          batchYear: newScheme.batchYear,
          version: newScheme.version,
          id: generatedCode,
          schemeCode: generatedCode,
          status: 'Draft',
          createdBy: user?.uid || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          isCommonPoolScheme: true,
        });

        toast({ title: "Pool Created", description: `Institutional standalone pool ${generatedCode} initialized.` });
      } else {
        // Batch instantiate standard program schemes
        const allSyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
        const globalUsedCodes = new Set(allSyllabiSnap.docs.map(d => d.data().subjectCode as string));

        for (const programId of newScheme.programIds) {
          const selectedProgram = programs.find(p => p.id === programId);
          if (!selectedProgram) continue;

          const branchPrefix = selectedProgram.branchPrefixes?.[newScheme.branch] || newScheme.branch.substring(0, 2).toUpperCase();
          const generatedCode = `${selectedProgram.code}-${branchPrefix}-${newScheme.batchYear}`;
          const schemeRef = doc(db, 'schemes', generatedCode);
          
          const existing = await getDoc(schemeRef);
          if (existing.exists()) continue;

          await setDoc(schemeRef, {
            programId: programId,
            branch: newScheme.branch,
            batchYear: newScheme.batchYear,
            version: newScheme.version,
            id: generatedCode,
            schemeCode: generatedCode,
            status: 'Draft',
            createdBy: user?.uid || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            isCommonPoolScheme: false,
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

            let sequence = 1;
            let finalCode = '';
            const yearSet = usedSuffixesInScheme.get(year)!;

            while (sequence < 100) {
              const seqStr = String(sequence).padStart(2, '0');
              const suffix = `${year}${seqStr}`;
              const candidate = `${branchPrefix}${pedagogy}${pillar}${suffix}`;
              
              if (!yearSet.has(seqStr) && !globalUsedCodes.has(candidate)) {
                finalCode = candidate;
                yearSet.add(seqStr);
                break;
              }
              sequence++;
            }

            const slotId = `SLOT-${cat}-${slot.semester}-${slot.id}`;
            const slotRef = doc(db, 'schemes', generatedCode, 'syllabi', slotId);
            
            batch.set(slotRef, {
              id: slotId,
              schemeId: generatedCode,
              subjectCode: finalCode || 'XX',
              semester: slot.semester,
              creditCategory: cat,
              credits: slot.credits,
              title: slot.title || `${cat}`,
              type: slot.type,
              lectureCredits: slot.lectureCredits,
              tutorialCredits: slot.tutorialCredits,
              practicalCredits: slot.practicalCredits,
              isSlot: true,
              units: [],
              poMappings: {},
              textBooks: [],
              referenceBooks: []
            });
          }
          await batch.commit();
        }
        toast({ title: "Schemes Initialized", description: "Successfully created departmental academic schemes." });
      }

      setIsDialogOpen(false);
      setStep(1);
      setNewScheme({ programIds: [], branch: '', batchYear: '', version: 'v1.0', isInstitutional: false, poolVertical: '' });
    } catch (error: any) {
      toast({ title: "Operation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteScheme = async (schemeId: string) => {
    if (!window.confirm("Are you sure you want to delete this draft scheme? All course content will be lost.")) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'schemes', schemeId));
      toast({ title: "Scheme Deleted" });
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
            <Plus className="w-4 h-4" /> New Scheme
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
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => handleDeleteScheme(scheme.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors">
                {scheme.isCommonPoolScheme ? scheme.branch : (programs.find(p => p.id === scheme.programId)?.name || 'Loading...')}
              </CardTitle>
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
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={step === 2 ? "max-w-5xl" : "max-w-2xl"}>
          <DialogHeader>
            <DialogTitle>Initialize Academic Identity</DialogTitle>
            <DialogDescription>
              Create standalone institutional pools or departmental schemes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {(isGlobalAdmin || isCommonBos) && (
              <div className="p-4 bg-muted/30 rounded-xl border border-dashed space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="font-bold flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Institutional Common Pool
                  </Label>
                  <Switch 
                    checked={newScheme.isInstitutional} 
                    onCheckedChange={(checked) => setNewScheme({...newScheme, isInstitutional: checked, programIds: [], poolVertical: ''})} 
                  />
                </div>
                {newScheme.isInstitutional && (
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Target Vertical Pool</Label>
                    <Select value={newScheme.poolVertical} onValueChange={(v: any) => setNewScheme({...newScheme, poolVertical: v})}>
                      <SelectTrigger><SelectValue placeholder="Select Vertical..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="B.Tech">B.Tech (Engineering)</SelectItem>
                        <SelectItem value="BBA">BBA (Management)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {!newScheme.isInstitutional && (
              <>
                <div className="space-y-4">
                  <Label className="text-sm font-bold">Select Academic Program(s)</Label>
                  <div className="border rounded-xl p-2 bg-muted/10">
                    <ScrollArea className="h-[180px] px-3">
                      {availablePrograms.map(p => (
                        <div key={p.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white cursor-pointer" onClick={() => toggleProgram(p.id)}>
                          <Checkbox checked={newScheme.programIds.includes(p.id)} />
                          <div className="flex flex-col">
                            <span className="text-xs font-bold">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground font-mono">{p.code}</span>
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>

                {newScheme.programIds.length > 0 && templateProgram?.branches?.length && (
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Select Specialization / Branch</Label>
                    <Select value={newScheme.branch} onValueChange={(v) => setNewScheme({...newScheme, branch: v})}>
                      <SelectTrigger><SelectValue placeholder="Select branch..." /></SelectTrigger>
                      <SelectContent>
                        {templateProgram.branches.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
            
            <div className="space-y-2">
              <Label className="text-sm font-bold">Batch Year</Label>
              <Input placeholder="e.g., 2024" value={newScheme.batchYear} onChange={(e) => setNewScheme({...newScheme, batchYear: e.target.value})} />
            </div>
          </div>

          <DialogFooter>
            {newScheme.isInstitutional ? (
              <Button onClick={handleCreateScheme} disabled={isCreating || !newScheme.batchYear || !newScheme.poolVertical}>
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Initialize Blank Pool
              </Button>
            ) : (
              <Button onClick={() => setStep(2)} disabled={newScheme.programIds.length === 0 || !newScheme.batchYear || !newScheme.branch}>
                Verify Template Patterns <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
