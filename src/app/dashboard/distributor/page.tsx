'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, writeBatch, serverTimestamp, collectionGroup } from 'firebase/firestore';
import { Scheme, Program, Syllabus, UserProfile, CreditCategory } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Share2, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Search, Building2, Filter, Layers } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function PoolDistributorPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const [batchYear, setBatchYear] = useState('');
  const [targetSemester, setTargetSemester] = useState('1');
  const [sourceSchemeId, setSourceSchemeId] = useState('');
  const [sourceSyllabusId, setSourceSyllabusId] = useState('');
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [isDistributing, setIsProcessing] = useState(false);
  const [poolSyllabi, setPoolSyllabi] = useState<Syllabus[]>([]);

  const { data: allPrograms } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));
  const { data: allSchemes } = useCollection<Scheme>(useMemoFirebase(() => collection(db, 'schemes'), [db]));

  const sourcePools = useMemo(() => 
    allSchemes.filter(s => s.isCommitteePool || s.isVerticalPool), 
  [allSchemes]);

  useEffect(() => {
    if (sourceSchemeId) {
      getDocs(collection(db, 'schemes', sourceSchemeId, 'syllabi')).then(snap => {
        setPoolSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
      });
    } else {
      setPoolSyllabi([]);
    }
  }, [sourceSchemeId, db]);

  const targetSchemes = useMemo(() => {
    if (!batchYear || selectedProgramIds.length === 0) return [];
    return allSchemes.filter(s => 
      s.batchYear === batchYear && 
      selectedProgramIds.includes(s.programId) &&
      !s.isCommitteePool && 
      !s.isVerticalPool
    );
  }, [allSchemes, batchYear, selectedProgramIds]);

  const generateInstitutionalCode = (sub: Syllabus, branchPrefix: string, sequence: number) => {
    const pedagogyChar = sub.type === 'Lab/Sessional' ? 'P' : (sub.creditCategory === 'PRJ' ? 'I' : 'L');
    const getPillarChar = (cat: CreditCategory) => {
      switch(cat) {
        case 'DSC': return 'C';
        case 'DSE': case 'OFE': return 'E';
        case 'SEC': return 'S';
        case 'VAC': return 'V';
        case 'AEC': return 'A';
        case 'MDC': return 'M';
        case 'PRJ': return 'P';
        default: return 'C';
      }
    };
    const pillarChar = getPillarChar(sub.creditCategory);
    const yearDigit = Math.ceil(Number(targetSemester) / 2);
    const seqStr = sequence.toString().padStart(2, '0');
    return `${branchPrefix}${pedagogyChar}${pillarChar}${yearDigit}${seqStr}`;
  };

  const handleDistribute = async () => {
    if (!sourceSyllabusId || targetSchemes.length === 0) return;
    setIsProcessing(true);

    const sourceSub = poolSyllabi.find(s => s.id === sourceSyllabusId);
    if (!sourceSub) return;

    try {
      const batch = writeBatch(db);
      
      // Fetch ALL syllabi to ensure global uniqueness for the new codes
      const universitySyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      const existingGlobalCodes = new Set(universitySyllabiSnap.docs.map(d => (d.data() as Syllabus).subjectCode));
      const assignedInBatch = new Set<string>();

      for (const targetScheme of targetSchemes) {
        const program = allPrograms.find(p => p.id === targetScheme.programId);
        const branchPrefix = program?.branchPrefixes?.[targetScheme.branch || ''] || 'XX';
        const isCommonCategory = ['VAC', 'AEC', 'MDC'].includes(sourceSub.creditCategory);
        const effectivePrefix = isCommonCategory ? 'RT' : branchPrefix;

        let sequence = 1;
        let localCode = '';
        
        while (true) {
          localCode = generateInstitutionalCode(sourceSub, effectivePrefix, sequence);
          if (!existingGlobalCodes.has(localCode) && !assignedInBatch.has(localCode)) break;
          sequence++;
          if (sequence > 99) break;
        }

        assignedInBatch.add(localCode);

        // Child entry logic
        const newSyllabusId = Math.random().toString(36).substr(2, 9);
        const syllabusRef = doc(db, 'schemes', targetScheme.id, 'syllabi', newSyllabusId);
        
        batch.set(syllabusRef, {
          id: newSyllabusId,
          schemeId: targetScheme.id,
          subjectCode: localCode,
          semester: Number(targetSemester),
          followedFromId: sourceSyllabusId,
          parentSchemeId: sourceSchemeId,
          parentCode: sourceSub.subjectCode,
          creditCategory: sourceSub.creditCategory,
          type: sourceSub.type,
          credits: sourceSub.credits,
          lectureCredits: sourceSub.lectureCredits,
          tutorialCredits: sourceSub.tutorialCredits,
          practicalCredits: sourceSub.practicalCredits,
          title: sourceSub.title, // Initial mirror
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      toast({ title: "Distribution Complete", description: `Injected standard course into ${targetSchemes.length} branch schemes.` });
      setSelectedProgramIds([]);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Bulk Distribution Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">Institutional Course Distributor</h1>
        <p className="text-muted-foreground">Bulk insert and link common pool subjects (Physics, Maths, VAC, etc.) across multiple BTECH programs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-4 h-fit border-primary/10 shadow-lg bg-gradient-to-br from-white to-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" /> Source Configuration
            </CardTitle>
            <CardDescription>Select the standard course to distribute university-wide.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">1. Source Pool</Label>
                <Select value={sourceSchemeId} onValueChange={setSourceSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select Pool..." /></SelectTrigger>
                  <SelectContent>
                    {sourcePools.map(p => <SelectItem key={p.id} value={p.id}>{p.branch} ({p.batchYear})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">2. Source Subject</Label>
                <Select value={sourceSyllabusId} onValueChange={setSourceSyllabusId} disabled={!sourceSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select Course..." /></SelectTrigger>
                  <SelectContent>
                    {poolSyllabi.map(s => <SelectItem key={s.id} value={s.id}>{s.subjectCode} - {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">3. Target Batch Year</Label>
                <Input placeholder="e.g. 2026-30" value={batchYear} onChange={e => setBatchYear(e.target.value)} className="bg-white" />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">4. Target Semester Slot</Label>
                <Select value={targetSemester} onValueChange={setTargetSemester}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-[10px] text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p><b>Note:</b> This will create new virtual slots in the target schemes. If a branch prefix exists, it will be used for the child's local code.</p>
            </div>

            <Button className="w-full h-12 gap-2 shadow-lg" onClick={handleDistribute} disabled={!sourceSyllabusId || targetSchemes.length === 0 || isDistributing}>
              {isDistributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Distribute to {targetSchemes.length} Schemes
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">Target Branches & Faculties</CardTitle>
                <CardDescription>Select BTECH programs to receive the institutional distribution.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedProgramIds(allPrograms.map(p => p.id))} className="text-[10px] uppercase font-bold">Select All</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProgramIds([])} className="text-[10px] uppercase font-bold">Clear</Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allPrograms.map(p => (
                    <div key={p.id} className="flex items-center space-x-3 p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                      <Checkbox 
                        id={p.id} 
                        checked={selectedProgramIds.includes(p.id)}
                        onCheckedChange={(checked) => {
                          const ids = checked 
                            ? [...selectedProgramIds, p.id] 
                            : selectedProgramIds.filter(id => id !== p.id);
                          setSelectedProgramIds(ids);
                        }}
                      />
                      <label htmlFor={p.id} className="flex flex-col cursor-pointer flex-1">
                        <span className="text-sm font-bold">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">{p.faculty}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Filter className="w-4 h-4" /> Active Target Matrix (Dry Run)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="p-6 text-center text-muted-foreground text-xs italic">
                 {targetSchemes.length === 0 ? (
                   "Select batch and programs to see targeted branch instances."
                 ) : (
                   <div className="flex flex-wrap gap-2 justify-center">
                     {targetSchemes.map(s => (
                       <Badge key={s.id} variant="outline" className="bg-primary/5 text-primary border-primary/20">
                         {s.branch}
                       </Badge>
                     ))}
                   </div>
                 )}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}