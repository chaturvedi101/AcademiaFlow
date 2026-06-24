'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, serverTimestamp, query, orderBy, getDoc } from 'firebase/firestore';
import { Scheme, Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Loader2, Calendar, FileText, ArrowRight, ShieldCheck, Info, Hash } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
  const [newScheme, setNewScheme] = useState({
    programId: '',
    branch: '',
    batchYear: '',
    version: 'v1.0'
  });

  const isCommonBos = profile?.faculty === 'University-wide (Common BOS)';

  const filteredSchemes = useMemo(() => {
    if (!profile) return [];
    
    if (
      profile.role === 'admin' || 
      profile.role === 'dean_academic' || 
      isCommonBos
    ) {
      return schemes;
    }

    if (profile.role === 'dean_faculty') {
      return schemes.filter(s => {
        const prog = programs.find(p => p.id === s.programId);
        return prog?.faculty === profile.faculty;
      });
    }

    const managed = profile.managedBranches || [];
    return schemes.filter(s => 
      managed.some(m => m.programId === s.programId && m.branch === s.branch) || s.isCommonPoolScheme
    );
  }, [schemes, profile, programs, isCommonBos]);

  const availablePrograms = useMemo(() => {
    if (!profile) return [];
    
    if (
      profile.role === 'admin' || 
      profile.role === 'dean_academic' || 
      isCommonBos
    ) {
      return programs;
    }

    if (profile.role === 'dean_faculty') {
      return programs.filter(p => p.faculty === profile.faculty);
    }

    const managedProgramIds = new Set(profile.managedBranches?.map(b => b.programId) || []);
    return programs.filter(p => managedProgramIds.has(p.id));
  }, [programs, profile, isCommonBos]);

  const selectedProgram = programs.find(p => p.id === newScheme.programId);

  const handleCreateScheme = async () => {
    if (!newScheme.programId || !newScheme.batchYear) {
      toast({ title: "Validation Error", description: "Program and Batch are required.", variant: "destructive" });
      return;
    }

    if (!selectedProgram) return;

    setIsCreating(true);

    const branchName = isCommonBos ? 'Institutional Common Pool' : newScheme.branch;
    const branchPrefix = isCommonBos 
      ? 'POOL' 
      : (selectedProgram.branchPrefixes?.[branchName] || branchName.substring(0, 3).toUpperCase());
    
    const creationYear = new Date().getFullYear();
    const generatedCode = `${selectedProgram.code}-${branchPrefix}-${creationYear}`;

    const schemeDocRef = doc(db, 'schemes', generatedCode);
    
    try {
      const existingDoc = await getDoc(schemeDocRef);
      if (existingDoc.exists()) {
        toast({ 
          title: "Conflict", 
          description: `A scheme with code ${generatedCode} already exists. Please update parameters or version.`, 
          variant: "destructive" 
        });
        setIsCreating(false);
        return;
      }

      const schemeData: Partial<Scheme> = {
        ...newScheme,
        id: generatedCode,
        branch: branchName,
        schemeCode: generatedCode,
        status: 'Draft' as const,
        createdBy: user?.uid || '',
        hasMultipleExits: false,
        abcEnabled: true,
        exitOptions: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isCommonPoolScheme: isCommonBos,
      };

      setDoc(schemeDocRef, schemeData)
        .then(() => {
          toast({ title: "Success", description: isCommonBos ? "Common Pool Scheme initialized." : "Branch Scheme created successfully." });
          router.push(`/dashboard/schemes/${generatedCode}`);
        })
        .catch((err) => {
          const permissionError = new FirestorePermissionError({
            path: `schemes/${generatedCode}`,
            operation: 'write',
            requestResourceData: schemeData,
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    } catch (error) {
      console.error("Error creating scheme:", error);
      toast({ title: "Error", description: "Failed to initialize scheme. Please try again.", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (schemesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Restrict creation: Standard BoS Convenors cannot create new schemes
  // Only Admin, Dean Faculty, and Common BoS Convenors have creation rights
  const canCreateScheme = profile?.role === 'admin' || profile?.role === 'dean_faculty' || (profile?.role === 'bos_convenor' && isCommonBos);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Academic Schemes</h1>
          <p className="text-muted-foreground">
            {isCommonBos 
              ? 'Developing common course schemes (VAC, AEC, MDC) once per Program for university-wide rollout.'
              : 'Draft, build, and manage branch-specific academic layouts.'}
          </p>
        </div>
        {canCreateScheme && (
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-lg">
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
                  <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[10px]">
                    {scheme.version}
                  </Badge>
                  <StatusBadge status={scheme.status} />
                </div>
                <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors flex items-center gap-2">
                  {program?.name || 'Loading...'}
                </CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-primary font-bold">
                    <Hash className="w-3 h-3" /> {scheme.schemeCode || 'GENERATING...'}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span className={scheme.isCommonPoolScheme ? 'font-bold text-emerald-700' : ''}>
                      {scheme.branch || 'General'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Batch: {scheme.batchYear}</span>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" className="w-full justify-between group-hover:bg-primary group-hover:text-white" asChild>
                  <Link href={`/dashboard/schemes/${scheme.id}`}>
                    Manage Layout <ArrowRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {filteredSchemes.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl bg-muted/20">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
            <p className="text-muted-foreground">No schemes found for your authorized branches.</p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isCommonBos ? 'Define Common Pool Scheme' : 'Create New Academic Scheme'}</DialogTitle>
            <DialogDescription>
              {isCommonBos 
                ? 'This scheme defines VAC, AEC, and MDC courses for ALL branches of the selected program.'
                : 'Select the program, branch, and batch to initialize your branch-specific core curriculum.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Academic Program</Label>
              <Select onValueChange={(v) => setNewScheme({...newScheme, programId: v, branch: ''})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program..." />
                </SelectTrigger>
                <SelectContent>
                  {availablePrograms.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {!isCommonBos && selectedProgram?.branches?.length ? (
              <div className="space-y-2">
                <Label>Branch / Specialization</Label>
                <Select value={newScheme.branch} onValueChange={(v) => setNewScheme({...newScheme, branch: v})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(profile?.role === 'bos_convenor'
                      ? selectedProgram.branches.filter(b => 
                          profile.managedBranches?.some(m => m.programId === selectedProgram.id && m.branch === b)
                        )
                      : selectedProgram.branches
                    ).map(b => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {isCommonBos && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-3 text-xs text-emerald-800">
                <Info className="w-4 h-4 shrink-0 text-emerald-600" />
                <p>This pool will be shared across all branches of <strong>{selectedProgram?.name || 'the program'}</strong>. It will include common VAC, AEC, and MDC courses.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Batch Year</Label>
              <Input 
                placeholder="e.g., 2024-28" 
                value={newScheme.batchYear} 
                onChange={(e) => setNewScheme({...newScheme, batchYear: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Version</Label>
              <Input 
                value={newScheme.version} 
                onChange={(e) => setNewScheme({...newScheme, version: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button onClick={handleCreateScheme} disabled={isCreating}>
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Initialize Scheme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: any = {
    'Draft': 'bg-slate-100 text-slate-700',
    'Pending Dean': 'bg-amber-100 text-amber-700',
    'Pending Academics': 'bg-blue-100 text-blue-700',
    'Approved': 'bg-emerald-100 text-emerald-700'
  };
  return <Badge variant="secondary" className={`${colors[status] || ''} border-none font-medium text-[10px]`}>{status}</Badge>;
}
