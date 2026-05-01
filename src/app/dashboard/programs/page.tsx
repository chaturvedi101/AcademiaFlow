
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import { Program } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, GraduationCap, Loader2, Calendar } from 'lucide-react';
import { ProgramDialog } from '@/components/programs/ProgramDialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ProgramsPage() {
  const db = useFirestore();
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs, loading } = useCollection<Program>(programsRef);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | undefined>(undefined);
  const { toast } = useToast();

  const handleDelete = (id: string) => {
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

  if (loading) {
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
          <h1 className="text-3xl font-headline font-bold">Program Catalog</h1>
          <p className="text-muted-foreground">Manage academic programs and their NEP 2020 credit frameworks.</p>
        </div>
        <Button onClick={() => { setSelectedProgram(undefined); setIsDialogOpen(true); }} className="gap-2 shadow-lg">
          <Plus className="w-4 h-4" /> Add Program
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Academic Programs</CardTitle>
          <CardDescription>Defined programs available for scheme creation.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Program Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Semesters</TableHead>
                <TableHead>Required Credits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((program) => (
                <TableRow key={program.id}>
                  <TableCell className="font-mono font-bold text-primary">{program.code}</TableCell>
                  <TableCell className="font-medium">{program.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{program.level}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{program.totalSemesters || 'N/A'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">{program.rules?.totalRequired || 'Not set'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedProgram(program); setIsDialogOpen(true); }}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => handleDelete(program.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {programs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No programs defined yet.</p>
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
      />
    </div>
  );
}
