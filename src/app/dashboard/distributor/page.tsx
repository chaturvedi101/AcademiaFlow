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
import { Share2, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Filter, Layers, History, ArrowRight, BookOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function PoolDistributorPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const [batchYear, setBatchYear] = useState('');
  const [targetSemester, setTargetSemester] = useState('1');
  const [sourceSchemeId, setSourceSchemeId] = useState('');
  const [selectedSourceSyllabusIds, setSelectedSourceSyllabusIds] = useState<string[]>([]);
  const [selectedProgramIds, setSelectedProgramIds] = useState<string[]>([]);
  const [isDistributing, setIsProcessing] = useState(false);
  const [poolSyllabi, setPoolSyllabi] = useState<Syllabus[]>([]);
  const [globalRegistry, setGlobalRegistry] = useState<Syllabus[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);

  const { data: allPrograms } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));
  const { data: allSchemes } = useCollection<Scheme>(useMemoFirebase(() => collection(db, 'schemes'), [db]));

  const sourcePools = useMemo(() => 
    allSchemes.filter(s => s.isCommitteePool || s.isVerticalPool), 
  [allSchemes]);

  const fetchGlobalRegistry = async () => {
    setRegistryLoading(true);
    try {
      const q = query(collectionGroup(db, 'syllabi'), where('followedFromId', '!=', null));
      const snap = await getDocs(q);
      const linked = snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus));
      setGlobalRegistry(linked);
    } catch (e) {
      console.error("Registry fetch failed:", e);
    } finally {
      setRegistryLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalRegistry();
  }, [db, isDistributing]);

  useEffect(() => {
    if (sourceSchemeId) {
      getDocs(collection(db, 'schemes', sourceSchemeId, 'syllabi')).then(snap => {
        setPoolSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
      });
    } else {
      setPoolSyllabi([]);
      setSelectedSourceSyllabusIds([]);
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

  const filteredRegistry = useMemo(() => {
    if (!sourceSchemeId) return [];
    return globalRegistry.filter(s => s.parentSchemeId === sourceSchemeId);
  }, [globalRegistry, sourceSchemeId]);

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
    if (selectedSourceSyllabusIds.length === 0 || targetSchemes.length === 0) return;
    setIsProcessing(true);

    try {
      const batch = writeBatch(db);
      
      // Fetch ALL syllabi to ensure global uniqueness for the new codes
      const universitySyllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      const existingGlobalCodes = new Set(universitySyllabiSnap.docs.map(d => (d.data() as Syllabus).subjectCode));
      const assignedInBatch = new Set<string>();

      for (const targetScheme of targetSchemes) {
        const program = allPrograms.find(p => p.id === targetScheme.programId);
        const branchPrefix = program?.branchPrefixes?.[targetScheme.branch || ''] || 'XX';
        
        for (const subId of selectedSourceSyllabusIds) {
          const sourceSub = poolSyllabi.find(s => s.id === subId);
          if (!sourceSub) continue;

          const isCommonCategory = ['VAC', 'AEC', 'MDC'].includes(sourceSub.creditCategory);
          const effectivePrefix = isCommonCategory ? 'RT' : branchPrefix;

          let sequence = 1;
          let localCode = '';
          
          while (true) {
            localCode = generateInstitutionalCode(sourceSub, effectivePrefix, sequence);
            const schemeSpecificCode = `${targetScheme.id}-${localCode}`;
            
            if (!existingGlobalCodes.has(localCode) && !assignedInBatch.has(schemeSpecificCode)) break;
            sequence++;
            if (sequence > 99) break;
          }

          assignedInBatch.add(`${targetScheme.id}-${localCode}`);

          const newSyllabusId = Math.random().toString(36).substr(2, 9);
          const syllabusRef = doc(db, 'schemes', targetScheme.id, 'syllabi', newSyllabusId);
          
          batch.set(syllabusRef, {
            id: newSyllabusId,
            schemeId: targetScheme.id,
            subjectCode: localCode,
            semester: Number(targetSemester),
            followedFromId: sourceSub.id,
            parentSchemeId: sourceSchemeId,
            parentCode: sourceSub.subjectCode,
            creditCategory: sourceSub.creditCategory,
            type: sourceSub.type,
            credits: sourceSub.credits,
            lectureCredits: sourceSub.lectureCredits,
            tutorialCredits: sourceSub.tutorialCredits,
            practicalCredits: sourceSub.practicalCredits,
            title: sourceSub.title,
            updatedAt: serverTimestamp()
          });
        }
      }

      await batch.commit();
      toast({ title: "Bulk Distribution Complete", description: `Injected standard courses into ${targetSchemes.length} branch schemes.` });
      setSelectedProgramIds([]);
      setSelectedSourceSyllabusIds([]);
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
        <p className="text-muted-foreground">Bulk insert and link common pool subjects across multiple programs with automatic heritage tracking.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-5 h-fit border-primary/10 shadow-lg bg-gradient-to-br from-white to-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" /> Distribution Engine
            </CardTitle>
            <CardDescription>Select and inject standard courses university-wide.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">1. Source Pool (Heritage Parent)</Label>
                <Select value={sourceSchemeId} onValueChange={setSourceSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select Pool..." /></SelectTrigger>
                  <SelectContent>
                    {sourcePools.map(p => <SelectItem key={p.id} value={p.id}>{p.branch} ({p.batchYear})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">2. Select Courses to Inherit</Label>
                  {poolSyllabi.length > 0 && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSourceSyllabusIds(poolSyllabi.map(s => s.id))} className="h-6 text-[9px] uppercase font-black">All</Button>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedSourceSyllabusIds([])} className="h-6 text-[9px] uppercase font-black">None</Button>
                    </div>
                  )}
                </div>
                <ScrollArea className="h-48 border rounded-xl bg-white p-2">
                  <div className="space-y-1">
                    {poolSyllabi.map(s => (
                      <div key={s.id} className="flex items-center space-x-2 p-2 hover:bg-muted/30 rounded-lg transition-colors group">
                        <Checkbox 
                          id={`sub-${s.id}`} 
                          checked={selectedSourceSyllabusIds.includes(s.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedSourceSyllabusIds([...selectedSourceSyllabusIds, s.id]);
                            else setSelectedSourceSyllabusIds(selectedSourceSyllabusIds.filter(id => id !== s.id));
                          }}
                        />
                        <label htmlFor={`sub-${s.id}`} className="flex flex-1 justify-between items-center cursor-pointer">
                          <span className="text-xs font-medium">{s.title}</span>
                          <Badge variant="outline" className="text-[9px] font-mono opacity-60 group-hover:opacity-100">{s.subjectCode}</Badge>
                        </label>
                      </div>
                    ))}
                    {poolSyllabi.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-xs italic">Select a pool to view subjects.</div>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">3. Target Batch</Label>
                  <Input placeholder="e.g. 2026-30" value={batchYear} onChange={e => setBatchYear(e.target.value)} className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">4. Target Semester</Label>
                  <Select value={targetSemester} onValueChange={setTargetSemester}>
                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button 
              className="w-full h-12 gap-2 shadow-lg" 
              onClick={handleDistribute} 
              disabled={selectedSourceSyllabusIds.length === 0 || targetSchemes.length === 0 || isDistributing}
            >
              {isDistributing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {isDistributing ? "Processing Batch Injection..." : `Distribute to ${targetSchemes.length} Branch Schemes`}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-7 space-y-6">
          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-lg">Target Branches & Faculties</CardTitle>
                <CardDescription>Select programs to receive the standard injection.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedProgramIds(allPrograms.map(p => p.id))} className="text-[10px] uppercase font-bold">All</Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedProgramIds([])} className="text-[10px] uppercase font-bold">Clear</Button>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <ScrollArea className="h-[250px] pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {allPrograms.map(p => (
                    <div key={p.id} className="flex items-center space-x-3 p-2.5 border rounded-lg hover:bg-muted/30 transition-colors">
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
                        <span className="text-xs font-bold">{p.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-black">{p.faculty}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="py-4 border-b bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <History className="w-4 h-4 text-primary" /> Inheritance Registry
                  </CardTitle>
                  <CardDescription className="text-[10px]">Active institutional mirrors for the selected pool.</CardDescription>
                </div>
                {registryLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[300px]">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="pl-6 text-[10px] uppercase font-black">Target Branch</TableHead>
                      <TableHead className="text-[10px] uppercase font-black">Inherited Mapping</TableHead>
                      <TableHead className="text-right pr-6 text-[10px] uppercase font-black">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistry.map((reg, idx) => {
                      const scheme = allSchemes.find(s => s.id === reg.schemeId);
                      return (
                        <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                          <TableCell className="pl-6">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold">{scheme?.branch || 'Department'}</span>
                              <span className="text-[9px] text-muted-foreground uppercase">{scheme?.batchYear}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px] font-mono bg-white">{reg.subjectCode}</Badge>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <Badge variant="secondary" className="text-[9px] font-mono bg-primary/5 text-primary border-primary/10">{reg.parentCode}</Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black">ACTIVE MIRROR</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredRegistry.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic text-xs">
                          {sourceSchemeId ? 'No distribution records found for this pool.' : 'Select a source pool to view its inheritance registry.'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
