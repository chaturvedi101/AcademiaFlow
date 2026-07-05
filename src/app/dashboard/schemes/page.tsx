
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, serverTimestamp, query, orderBy, getDoc, writeBatch, collectionGroup, getDocs, deleteDoc } from 'firebase/firestore';
import { Scheme, Program, UserProfile, CreditCategory, SubjectType, FACULTIES } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Loader2, FileText, ArrowRight, ShieldCheck, Hash, Trash2, GraduationCap, Info, Layers, CheckCircle2, FlaskConical } from 'lucide-react';
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
    poolType: 'Vertical' as 'Vertical' | 'Committee',
    poolVertical: '' as 'B.Tech' | 'BBA' | '',
    committeeName: '' as string
  });

  const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile?.role || '');
  const isCommitteeConvenor = profile?.role === 'committee_convenor';
  const isCommonBos = profile?.faculty?.includes('(Common BOS)');

  const filteredSchemes = useMemo(() => {
    if (!profile || !programs.length) return [];
    if (isGlobalAdmin || profile.role === 'monitor') return schemes;
    
    return schemes.filter(s => {
      // Committee Convenors see their pool
      if (isCommitteeConvenor && s.isCommitteePool && s.branch === profile.faculty) return true;
      
      // Common BOS logic
      if (isCommonBos) {
        if (profile.faculty === 'B.Tech (Common BOS)') return s.branch === 'B.Tech (Common BOS) Pool' || programs.find(p => p.id === s.programId)?.faculty.includes('Engineering');
        if (profile.faculty === 'BBA (Common BOS)') return s.branch === 'BBA (Common BOS) Pool' || programs.find(p => p.id === s.programId)?.faculty.includes('Management');
      }

      // Default Branch Access
      return profile.managedBranches?.some(mb => mb.programId === s.programId && mb.branch === s.branch);
    });
  }, [schemes, profile, programs, isGlobalAdmin, isCommitteeConvenor, isCommonBos]);

  const committeeList = useMemo(() => FACULTIES.filter(f => f.startsWith('Course Committee')), []);

  const handleCreateScheme = async () => {
    if (!newScheme.batchYear) {
      toast({ title: "Validation Error", description: "Batch Year is required.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);

    try {
      if (newScheme.isInstitutional) {
        let branchName = '';
        let generatedCode = '';
        let isCommittee = false;

        if (newScheme.poolType === 'Vertical') {
          const verticalLabel = newScheme.poolVertical;
          branchName = `${verticalLabel} (Common BOS) Pool`;
          generatedCode = `${verticalLabel.toUpperCase()}-POOL-${newScheme.batchYear}`;
        } else {
          branchName = newScheme.committeeName;
          const prefix = branchName.split('-')[1]?.trim().toUpperCase().substring(0, 4) || 'COMM';
          generatedCode = `${prefix}-POOL-${newScheme.batchYear}`;
          isCommittee = true;
        }
        
        const schemeRef = doc(db, 'schemes', generatedCode);
        const existing = await getDoc(schemeRef);
        
        if (existing.exists()) throw new Error(`Pool ${generatedCode} already exists.`);

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
          isCommonPoolScheme: !isCommittee,
          isCommitteePool: isCommittee
        });

        toast({ title: "Pool Created", description: `${branchName} initialized.` });
      } else {
        // Standard program creation (batch)
        if (newScheme.programIds.length === 0 || !newScheme.branch) {
          toast({ title: "Validation Error", description: "Programs and Branch name are required.", variant: "destructive" });
          setIsCreating(false);
          return;
        }

        const batch = writeBatch(db);
        for (const pid of newScheme.programIds) {
          const program = programs.find(p => p.id === pid);
          if (!program) continue;
          
          const codePrefix = program.branchPrefixes?.[newScheme.branch] || pid.substring(0, 3).toUpperCase();
          const sid = `${pid.toUpperCase()}-${codePrefix}-${newScheme.batchYear}`;
          
          batch.set(doc(db, 'schemes', sid), {
            programId: pid,
            branch: newScheme.branch,
            batchYear: newScheme.batchYear,
            version: newScheme.version,
            id: sid,
            schemeCode: sid,
            status: 'Draft',
            createdBy: user?.uid || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Pattern Copy Logic
          if (program.slotTemplate) {
            program.slotTemplate.forEach(slot => {
              const syllId = Math.random().toString(36).substr(2, 9);
              batch.set(doc(db, 'schemes', sid, 'syllabi', syllId), {
                ...slot,
                id: syllId,
                schemeId: sid,
                isSlot: true,
                updatedAt: serverTimestamp()
              });
            });
          }
        }
        await batch.commit();
        toast({ title: "Schemes Created", description: `${newScheme.programIds.length} frameworks initialized.` });
      }

      setIsDialogOpen(false);
      setNewScheme({ programIds: [], branch: '', batchYear: '', version: 'v1.0', isInstitutional: false, poolType: 'Vertical', poolVertical: '', committeeName: '' });
      setStep(1);
    } catch (error: any) {
      toast({ title: "Operation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (schemesLoading) return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Academic Schemes</h1>
          <p className="text-muted-foreground">Manage institutional curriculum layouts and centralized course pools.</p>
        </div>
        {(isGlobalAdmin || isCommonBos || isCommitteeConvenor) && (
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> New Scheme
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchemes.map((scheme) => (
          <Card key={scheme.id} className={`hover:shadow-md transition-shadow group relative overflow-hidden ${scheme.isCommonPoolScheme ? 'border-emerald-200 bg-emerald-50/20' : scheme.isCommitteePool ? 'border-blue-200 bg-blue-50/20' : ''}`}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <Badge variant="outline" className="text-[10px]">{scheme.version}</Badge>
                {scheme.isCommitteePool && <Badge className="bg-blue-100 text-blue-700 border-none font-black text-[8px] uppercase">Committee Pool</Badge>}
                {scheme.isCommonPoolScheme && <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] uppercase">Common Pool</Badge>}
              </div>
              <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors">
                {scheme.branch || (programs.find(p => p.id === scheme.programId)?.name || 'Scheme')}
              </CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-mono text-[10px] text-primary font-bold"><Hash className="w-3 h-3" /> {scheme.schemeCode}</div>
                <div className="text-[11px] font-bold text-muted-foreground">Batch: {scheme.batchYear}</div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-white" asChild>
                <Link href={`/dashboard/schemes/${scheme.id}`}>Open Pool Architect <ArrowRight className="w-4 h-4" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Initialize Academic Repository</DialogTitle>
            <DialogDescription>Select the type of pool or scheme to create for the current batch.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-4 bg-muted/30 rounded-xl border border-dashed space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Centralized Repository Pool
                </Label>
                <Switch 
                  checked={newScheme.isInstitutional} 
                  onCheckedChange={(checked) => setNewScheme({...newScheme, isInstitutional: checked})} 
                />
              </div>
              
              {newScheme.isInstitutional && (
                <div className="space-y-4 pt-2 border-t mt-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Pool Hierarchy</Label>
                    <Select value={newScheme.poolType} onValueChange={(v: any) => setNewScheme({...newScheme, poolType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vertical">Institutional Vertical (B.Tech/BBA)</SelectItem>
                        <SelectItem value="Committee">Course Committee (Math/Physics/etc.)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newScheme.poolType === 'Vertical' ? (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold">Target Vertical</Label>
                      <Select value={newScheme.poolVertical} onValueChange={(v: any) => setNewScheme({...newScheme, poolVertical: v})}>
                        <SelectTrigger><SelectValue placeholder="Select Vertical..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="B.Tech">B.Tech (Engineering)</SelectItem>
                          <SelectItem value="BBA">BBA (Management)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold">Course Committee</Label>
                      <Select value={newScheme.committeeName} onValueChange={(v: any) => setNewScheme({...newScheme, committeeName: v})}>
                        <SelectTrigger><SelectValue placeholder="Select Committee..." /></SelectTrigger>
                        <SelectContent>
                          {committeeList.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!newScheme.isInstitutional && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Select Academic Program(s)</Label>
                  <ScrollArea className="h-48 border rounded-lg p-4 bg-white">
                    <div className="space-y-3">
                      {programs.map(p => (
                        <div key={p.id} className="flex items-center space-x-3">
                          <Checkbox 
                            id={p.id} 
                            checked={newScheme.programIds.includes(p.id)}
                            onCheckedChange={(checked) => {
                              const ids = checked 
                                ? [...newScheme.programIds, p.id] 
                                : newScheme.programIds.filter(id => id !== p.id);
                              setNewScheme({...newScheme, programIds: ids});
                            }}
                          />
                          <label htmlFor={p.id} className="text-sm cursor-pointer">
                            <span className="font-bold text-primary mr-2">{p.code}</span>
                            {p.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Branch Name (Common for selected programs)</Label>
                  <Input placeholder="e.g. Civil Engineering" value={newScheme.branch} onChange={e => setNewScheme({...newScheme, branch: e.target.value})} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-bold">Batch Year</Label>
              <Input placeholder="e.g. 2024" value={newScheme.batchYear} onChange={e => setNewScheme({...newScheme, batchYear: e.target.value})} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCreateScheme} disabled={isCreating || !newScheme.batchYear || (newScheme.isInstitutional && !newScheme.poolVertical && !newScheme.committeeName)}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {newScheme.isInstitutional ? "Initialize Blank Pool" : "Instantiate Schemes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
