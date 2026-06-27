
'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import { Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, GraduationCap, Loader2, Calendar, Eye, ShieldAlert, Copy } from 'lucide-react';
import { ProgramDialog } from '@/components/programs/ProgramDialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

export default function ProgramsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs, loading: programsLoading } = useCollection<Program>(programsRef);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | undefined>(undefined);

  const isAdminOrDeanAcad = profile?.role === 'admin' || profile?.role === 'dean_academic';

  const filteredPrograms = useMemo(() => {
    if (!profile) return [];
    // Only Admin and Dean Academic see the program catalog page
    if (isAdminOrDeanAcad) {
      return programs;
    }
    return [];
  }, [programs, profile, isAdminOrDeanAcad]);

  const handleDelete = (id: string) => {
    if (!isAdminOrDeanAcad) return;
    const programRef = doc(db, 'programs', id);
    deleteDoc(programRef)
      .catch((err) => {
        const permissionError = new FirestorePermissionError({
          path: programRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleCopy = (program: Program) => {
    // Strip ID and timestamps to treat it as a new program entry
    const { id, createdAt, updatedAt, ...copyData } = program;
    setSelectedProgram({
      ...copyData,
      name: `${program.name} (Copy)`,
      code: `${program.code}-COPY`,
    } as any);
    setIsDialogOpen(true);
  };

  if (profileLoading || programsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Final check for unauthorized access
  if (!isAdminOrDeanAcad) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 opacity-20" />
        <h2 className="text-2xl font-headline font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The Program Catalog is restricted to university-level leadership (Dean Academic & System Administrators).
        </p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const canCreateProgram = profile?.role === 'admin' || profile?.role === 'dean_academic';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Program Catalog</h1>
          <p className="text-muted-foreground">
            Institutional catalog of academic programs and NEP 2020 frameworks.
          </p>
        </div>
        {canCreateProgram && (
          <Button onClick={() => { setSelectedProgram(undefined); setIsDialogOpen(true); }} className="gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> Add Program
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Academic Programs</CardTitle>
          <CardDescription>
            Defined programs available for university-wide scheme creation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Program Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Semesters</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPrograms.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="pl-6 font-mono font-bold text-primary">{program.code}</TableCell>
                  <TableCell className="font-medium">{program.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] whitespace-nowrap">{program.faculty}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{program.level}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{program.totalSemesters || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleCopy(program)}
                        title="Duplicate Program Framework"
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedProgram(program); setIsDialogOpen(true); }}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      {profile?.role === 'admin' && (
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDelete(program.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPrograms.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No programs found.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProgramDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        program={selectedProgram}
        userProfile={profile || undefined}
      />
    </div>
  );
}
