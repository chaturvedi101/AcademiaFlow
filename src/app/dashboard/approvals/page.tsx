
'use client';

import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { Scheme, Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle, Eye, Loader2, FileCheck, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { useMemo } from 'react';

export default function ApprovalsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const targetStatus = profile?.role === 'dean_faculty' ? 'Pending Dean' : 'Pending Academics';
  
  const schemesQuery = useMemoFirebase(() => {
    return query(collection(db, 'schemes'), where('status', '==', targetStatus));
  }, [db, targetStatus]);

  const { data: schemes, loading } = useCollection<Scheme>(schemesQuery);
  const { data: programs } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));

  const filteredSchemes = useMemo(() => {
    if (!profile || !programs.length) return [];
    if (profile.role === 'dean_academic' || profile.role === 'admin') return schemes;
    
    // Dean Faculty only sees schemes from their faculty
    return schemes.filter(s => {
      const prog = programs.find(p => p.id === s.programId);
      return prog?.faculty === profile.faculty;
    });
  }, [schemes, profile, programs]);

  const handleApprove = (scheme: Scheme) => {
    const nextStatus = profile?.role === 'dean_faculty' ? 'Pending Academics' : 'Approved';
    const schemeRef = doc(db, 'schemes', scheme.id);
    
    updateDoc(schemeRef, { 
      status: nextStatus, 
      updatedAt: serverTimestamp() 
    }).then(() => {
      toast({ title: "Scheme Advanced", description: `Scheme moved to ${nextStatus}.` });
    }).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: schemeRef.path,
        operation: 'update',
        requestResourceData: { status: nextStatus }
      }));
    });
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Academic Approvals</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'dean_faculty' 
            ? `Reviewing schemes for ${profile.faculty}.` 
            : 'Reviewing schemes for university-wide accreditation.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-accent" />
            Pending Your Review
          </CardTitle>
          <CardDescription>
            Schemes awaiting {profile?.role?.replace('_', ' ')} validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Program & Batch</TableHead>
                <TableHead>Faculty</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchemes.map((scheme) => {
                const program = programs.find(p => p.id === scheme.programId);
                return (
                  <TableRow key={scheme.id}>
                    <TableCell className="pl-6">
                      <div className="space-y-1">
                        <p className="font-bold">{program?.name}</p>
                        <p className="text-xs text-muted-foreground">Batch: {scheme.batchYear}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{program?.faculty}</Badge>
                    </TableCell>
                    <TableCell>{scheme.version}</TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/schemes/${scheme.id}`} className="gap-2">
                            <Eye className="w-4 h-4" /> Review
                          </Link>
                        </Button>
                        <Button size="sm" className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(scheme)}>
                          <CheckCircle className="w-4 h-4" /> Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredSchemes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                    <FileCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No schemes currently pending your approval.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
