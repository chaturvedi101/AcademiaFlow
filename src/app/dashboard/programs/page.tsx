'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import { Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit3, Trash2, GraduationCap, Loader2, Calendar, Eye } from 'lucide-react';
import { ProgramDialog } from '@/components/programs/ProgramDialog';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function ProgramsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs, loading } = useCollection<Program>(programsRef);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | undefined>(undefined);

  const isCommonBos = profile?.faculty === 'University-wide (Common BOS)';

  const filteredPrograms = useMemo(() => {
    if (!profile) return [];
    // Admins, Dean Academics, and University-wide Common BOS see all programs
    if (
      profile.role === 'admin' || 
      profile.role === 'dean_academics' || 
      isCommonBos
    ) {
      return programs;
    }
    // Dean Faculty can see programs within their faculty
    if (profile.role === 'dean_faculty') {
      return programs.filter(p => p.faculty === profile.faculty);
    }
    return [];
  }, [programs, profile, isCommonBos]);

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

  // Common BOS cannot create programs
  const canCreateProgram = (profile?.role === 'admin' || profile?.role === 'dean_faculty') && !isCommonBos;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Program Catalog</h1>
          <p className="text-muted-foreground">
            {isCommonBos 
              ? 'Viewing all university programs to coordinate common course delivery.'
              : profile?.role === 'dean_faculty' 
                ? `Manage programs for ${profile.faculty}.` 
                : 'Manage university-wide academic programs and NEP 2020 frameworks.'}
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
            {isCommonBos
              ? 'Institutional catalog for planning VAC, AEC, SEC, and MDC course sequences.'
              : profile?.role === 'dean_faculty' 
                ? `Programs offered under the ${profile.faculty}.` 
                : 'Defined programs available for scheme creation.'}
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
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedProgram(program); setIsDialogOpen(true); }}>
                        {isCommonBos ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                      </Button>
                      {(profile?.role === 'admin' && !isCommonBos) && (
                        <Button variant="ghost" size="icon" className="text-red-400" onClick={() => handleDelete(program.id)}>
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
