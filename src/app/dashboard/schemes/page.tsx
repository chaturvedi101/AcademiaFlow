"use client";

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, query, orderBy, writeBatch } from 'firebase/firestore';
import { Scheme, Program, UserProfile, FACULTIES } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Loader2, ArrowRight, Hash, Layers, Clock, CheckCircle2, FileText } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function SchemesPage() {
  const db = useFirestore();
  const { user } = useUser();
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
  const [newScheme, setNewScheme] = useState({
    programIds: [] as string[],
    branch: '',
    batchYear: '',
    version: 'v1.0',
    isPoolScheme: false,
    poolType: 'Vertical' as 'Vertical' | 'Committee',
    poolVertical: '' as 'BTECH' | 'BBA' | '',
    committeeName: '' as string
  });

  const filteredSchemes = useMemo(() => {
    if (!profile || !programs.length) return [];
    
    // 1. Global Oversight (Admin, Dean Academic, and Monitor)
    if (profile.role === 'admin' || profile.role === 'dean_academic' || profile.role === 'monitor') {
      return schemes;
    }
    
    const isCommonTier = profile.faculty?.includes('(Common BOS)');
    const isBTECHTier = profile.faculty?.includes('BTECH');
    const isBBATier = profile.faculty?.includes('BBA');
    const isScienceDean = profile.role === 'dean_faculty' && profile.faculty === 'Faculty of Sciences';

    return schemes.filter(s => {
      // 2. Committee Convenors
      if (profile.role === 'committee_convenor' && s.isCommitteePool && s.branch === profile.faculty) return true;
      
      // 3. Purview Logic for Deans & Common BOS
      if (profile.role === 'dean_faculty' || isCommonTier) {
        // Pool Matching
        if (s.programId === 'INSTITUTIONAL') {
          // Special Oversight: Dean Sciences for Science Committees
          if (isScienceDean) {
             const scienceCommittees = ['Course Committee - Physics', 'Course Committee - Chemistry', 'Course Committee - Mathematics'];
             if (scienceCommittees.includes(s.branch || '')) return true;
          }

          if (isBTECHTier && (s.branch?.includes('BTECH') || s.isVerticalPool)) return true;
          if (isBBATier && (s.branch?.includes('BBA') || s.isVerticalPool)) return true;
          return false;
        }

        // Program Matching
        const prog = programs.find(p => p.id === s.programId);
        if (!prog) return false;

        // Faculty Match (Strict for normal Deans, Tier-based for Common BOS)
        if (profile.role === 'dean_faculty' && prog.faculty === profile.faculty) return true;
        
        if (isBTECHTier) return prog.faculty.includes('BTECH') || prog.name.includes('BTECH');
        if (isBBATier) return prog.faculty.includes('Management') || prog.name.includes('BBA');
      }

      // 4. Branch Personnel
      return profile.managedBranches?.some(mb => mb.programId === s.programId && mb.branch === s.branch);
    });
  }, [schemes, profile, programs]);

  const committeeList = useMemo(() => FACULTIES.filter(f => f.startsWith('Course Committee')), []);

  const handleCreateScheme = async () => {
    if (!newScheme.batchYear) {
      toast({ title: "Validation Error", description: "Batch Year is required.", variant: "destructive" });
      return;
    }
    
    setIsCreating(true);

    try {
      const batch = writeBatch(db);

      if (newScheme.isPoolScheme) {
        let branchName = '';
        let generatedCode = '';
        let isCommittee = false;

        if (newScheme.poolType === 'Vertical') {
          const verticalLabel = newScheme.poolVertical || 'BTECH';
          branchName = `${verticalLabel} (Common BOS) Pool`;
          generatedCode = `${verticalLabel}-POOL-${newScheme.batchYear}`;
        } else {
          branchName = newScheme.committeeName;
          // Robust Prefix Mapping for standard committees
          let prefix = 'COMM';
          if (branchName.includes('Mathematics')) prefix = 'MATH';
          else if (branchName.includes('Physics')) prefix = 'PHYS';
          else if (branchName.includes('Chemistry')) prefix = 'CHEM';
          else if (branchName.includes('Humanities')) prefix = 'HUMA';
          else if (branchName.includes('Basic Sciences')) prefix = 'BSCI';
          else prefix = branchName.split('-')[1]?.trim().toUpperCase().substring(0, 4) || 'COMM';

          generatedCode = `${prefix}-POOL-${newScheme.batchYear}`;
          isCommittee = true;
        }
        
        const schemeRef = doc(db, 'schemes', generatedCode);
        batch.set(schemeRef, {
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
          isVerticalPool: !isCommittee,
          isCommitteePool: isCommittee,
          hasMultipleExits: false,
          exitOptions: [],
          abcEnabled: true
        });

        await batch.commit();
        toast({ title: "Institutional Pool Initialized" });
      } else {
        for (const pid of newScheme.programIds) {
          const program = programs.find(p => p.id === pid);
          if (!program) continue;
          
          const branchPrefix = program.branchPrefixes?.[newScheme.branch] || pid.substring(0, 3).toUpperCase();
          const sid = `${pid.toUpperCase()}-${branchPrefix.replace(/[^A-Z]/g, '')}-${newScheme.batchYear}`;
          
          // 1. Initialize the Scheme Document
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
            updatedAt: serverTimestamp(),
            hasMultipleExits: false,
            exitOptions: [],
            abcEnabled: true
          });

          // 2. Auto-instantiate Syllabus slots from Master Pattern
          if (program.slotTemplate && program.slotTemplate.length > 0) {
            program.slotTemplate.forEach(slot => {
              const syllabusId = Math.random().toString(36).substr(2, 9);
              const syllabusRef = doc(db, 'schemes', sid, 'syllabi', syllabusId);
              
              // Resolve code: Replace "XX" placeholders with actual branch prefix
              let finalCode = slot.subjectCode || 'XXXXXXX';
              if (finalCode.startsWith('XX')) {
                finalCode = branchPrefix + finalCode.substring(2);
              }

              batch.set(syllabusRef, {
                id: syllabusId,
                schemeId: sid,
                subjectCode: finalCode,
                title: slot.title || (['VAC', 'AEC', 'MDC', 'OFE'].includes(slot.creditCategory) ? 'Institutional Pool Slot' : 'Slot Placeholder'),
                credits: slot.credits,
                lectureCredits: slot.lectureCredits,
                tutorialCredits: slot.tutorialCredits,
                practicalCredits: slot.practicalCredits,
                semester: slot.semester,
                type: slot.type,
                creditCategory: slot.creditCategory,
                electiveGroupId: slot.electiveGroupId || '',
                isSlot: true, // Flag as a master template instantiation
                updatedAt: serverTimestamp()
              });
            });
          }
        }
        await batch.commit();
        toast({ title: "Branch Schemes & Master Patterns Synchronized" });
      }

      setIsDialogOpen(false);
      setNewScheme({ programIds: [], branch: '', batchYear: '', version: 'v1.0', isPoolScheme: false, poolType: 'Vertical', poolVertical: '', committeeName: '' });
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
          <p className="text-muted-foreground">Monitoring {filteredSchemes.length} schemes in your institutional jurisdiction.</p>
        </div>
        {(['admin', 'dean_academic', 'committee_convenor'].includes(profile?.role || '') || profile?.faculty?.includes('(Common BOS)')) && (
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> New Scheme
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchemes.map((scheme) => (
          <Card key={scheme.id} className={`hover:shadow-md transition-shadow group relative overflow-hidden ${scheme.isVerticalPool ? 'border-emerald-200 bg-emerald-50/20' : scheme.isCommitteePool ? 'border-blue-200 bg-blue-50/20' : ''}`}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex flex-col gap-1">
                  <Badge variant="outline" className="text-[10px] w-fit">{scheme.version}</Badge>
                  {scheme.status === 'Approved' ? (
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] gap-1 px-1.5 py-0">
                      <CheckCircle2 className="w-3 h-3" /> APPROVED
                    </Badge>
                  ) : scheme.status.includes('Pending') ? (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[9px] gap-1 px-1.5 py-0">
                      <Clock className="w-3 h-3" /> {scheme.status.toUpperCase()}
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] gap-1 px-1.5 py-0">
                      <FileText className="w-3 h-3" /> DRAFT
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  {scheme.isCommitteePool && <Badge className="bg-blue-100 text-blue-700 border-none font-black text-[8px] uppercase">Committee Pool</Badge>}
                  {scheme.isVerticalPool && <Badge className="bg-emerald-100 text-emerald-700 border-none font-black text-[8px] uppercase">Vertical Pool</Badge>}
                </div>
              </div>
              <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors">
                {scheme.branch || (programs.find(p => p.id === scheme.programId)?.name || 'Institutional Scheme')}
              </CardTitle>
              <CardDescription className="flex flex-col gap-1">
                <div className="flex items-center gap-2 font-mono text-[10px] text-primary font-bold"><Hash className="w-3 h-3" /> {scheme.schemeCode}</div>
                <div className="text-[11px] font-bold text-muted-foreground uppercase">Batch: {scheme.batchYear}</div>
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
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="p-4 bg-muted/30 rounded-xl border border-dashed space-y-4">
              <div className="flex items-center justify-between">
                <Label className="font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4" /> Vertical or Committee Pool
                </Label>
                <Switch 
                  checked={newScheme.isPoolScheme} 
                  onCheckedChange={(checked) => setNewScheme({...newScheme, isPoolScheme: checked})} 
                />
              </div>
              
              {newScheme.isPoolScheme && (
                <div className="space-y-4 pt-2 border-t mt-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Pool Type</Label>
                    <Select value={newScheme.poolType} onValueChange={(v: any) => setNewScheme({...newScheme, poolType: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Vertical">Vertical Common Pool (BTECH/BBA)</SelectItem>
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
                          <SelectItem value="BTECH">BTECH (Engineering)</SelectItem>
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

            {!newScheme.isPoolScheme && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Select Program(s)</Label>
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
                  <Label className="text-sm font-bold">Branch Name</Label>
                  <Input placeholder="e.g. Mechanical Engineering" value={newScheme.branch} onChange={e => setNewScheme({...newScheme, branch: e.target.value})} />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-bold">Batch Year</Label>
              <Input placeholder="e.g. 2026-30" value={newScheme.batchYear} onChange={e => setNewScheme({...newScheme, batchYear: e.target.value})} />
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleCreateScheme} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {newScheme.isPoolScheme ? "Initialize Pool" : "Generate Schemes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}