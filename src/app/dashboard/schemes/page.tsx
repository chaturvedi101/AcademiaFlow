'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useUser, useMemoFirebase, useDoc } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, doc } from 'firebase/firestore';
import { Scheme, Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Loader2, Calendar, FileText, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  const { data: programs } = useCollection<Program>(collection(db, 'programs'));
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newScheme, setNewScheme] = useState({
    programId: '',
    branch: '',
    batchYear: '',
    version: 'v1.0'
  });

  const filteredSchemes = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_faculty' || profile.role === 'dean_academics') {
      return schemes;
    }
    const managed = profile.managedBranches || [];
    return schemes.filter(s => 
      managed.some(m => m.programId === s.programId && m.branch === s.branch)
    );
  }, [schemes, profile]);

  const availablePrograms = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_academics') {
      return programs;
    }
    const managedProgramIds = new Set(profile.managedBranches?.map(b => b.programId) || []);
    return programs.filter(p => managedProgramIds.has(p.id));
  }, [programs, profile]);

  const selectedProgram = programs.find(p => p.id === newScheme.programId);

  const handleCreateScheme = () => {
    if (!newScheme.programId || !newScheme.batchYear) {
      toast({ title: "Validation Error", description: "Program and Batch are required.", variant: "destructive" });
      return;
    }

    if (selectedProgram?.branches?.length && !newScheme.branch) {
      toast({ title: "Validation Error", description: "Please select a branch for this program.", variant: "destructive" });
      return;
    }

    const schemeData = {
      ...newScheme,
      status: 'Draft' as const,
      createdBy: user?.uid,
      hasMultipleExits: false,
      abcEnabled: true,
      exitOptions: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    addDoc(collection(db, 'schemes'), schemeData)
      .then((docRef) => {
        toast({ title: "Success", description: "Scheme created successfully." });
        router.push(`/dashboard/schemes/${docRef.id}`);
      })
      .catch((err) => {
        const permissionError = new FirestorePermissionError({
          path: 'schemes',
          operation: 'create',
          requestResourceData: schemeData,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  if (schemesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Academic Schemes</h1>
          <p className="text-muted-foreground">Draft, build, and manage university academic layouts.</p>
        </div>
        {(profile?.role === 'bos_convenor' || profile?.role === 'admin') && (
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> New Scheme
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSchemes.map((scheme) => {
          const program = programs.find(p => p.id === scheme.programId);
          return (
            <Card key={scheme.id} className="hover:shadow-md transition-shadow group">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline" className="bg-primary/5 text-primary border-none text-[10px]">
                    {scheme.version}
                  </Badge>
                  <StatusBadge status={scheme.status} />
                </div>
                <CardTitle className="font-headline text-lg group-hover:text-primary transition-colors">
                  {program?.name || 'Loading program...'}
                </CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{scheme.branch || 'General'}</span>
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
                    Manage Scheme <ArrowRight className="w-4 h-4" />
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
            <DialogTitle>Create New Academic Scheme</DialogTitle>
            <DialogDescription>Select the program, branch, and batch to initialize.</DialogDescription>
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
            
            {selectedProgram?.branches?.length ? (
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateScheme}>Initialize Scheme</Button>
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
