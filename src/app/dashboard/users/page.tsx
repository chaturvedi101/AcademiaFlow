
'use client';

import { useState } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Program, ManagedBranch } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Users, ShieldCheck, Plus, X, GraduationCap, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function UserManagementPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { data: users, loading: usersLoading } = useCollection<UserProfile>(collection(db, 'users'));
  const { data: programs } = useCollection<Program>(collection(db, 'programs'));
  
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [selection, setSelection] = useState({ programId: '', branch: '' });

  const convenors = users.filter(u => u.role === 'bos_convenor');

  const handleAssign = (userId: string) => {
    if (!selection.programId || !selection.branch) return;

    const user = users.find(u => u.id === userId);
    if (!user) return;

    const managedBranches = [...(user.managedBranches || []), { ...selection }];
    const userRef = doc(db, 'users', userId);

    updateDoc(userRef, { managedBranches })
      .then(() => {
        toast({ title: "Convenor Assigned", description: "Authorization updated successfully." });
        setAssigningUser(null);
        setSelection({ programId: '', branch: '' });
      })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'update',
          requestResourceData: { managedBranches }
        }));
      });
  };

  const removeAssignment = (userId: string, programId: string, branch: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    const managedBranches = user.managedBranches?.filter(b => !(b.programId === programId && b.branch === branch));
    const userRef = doc(db, 'users', userId);

    updateDoc(userRef, { managedBranches })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: userRef.path,
          operation: 'update'
        }));
      });
  };

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">BoS Convenor Authorization</h1>
        <p className="text-muted-foreground">Map academic personnel to specific program branches they are authorized to manage.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Active BoS Convenors
          </CardTitle>
          <CardDescription>Assign or revoke branch-level permissions for academic staff.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Convenor Details</TableHead>
                <TableHead>Authorized Branches</TableHead>
                <TableHead className="text-right pr-6">Management</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {convenors.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="pl-6">
                    <div className="space-y-1">
                      <p className="font-bold">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {user.managedBranches?.map((mb, idx) => {
                        const prog = programs.find(p => p.id === mb.programId);
                        return (
                          <Badge key={idx} variant="outline" className="gap-2 bg-primary/5 border-primary/20 text-xs py-1">
                            <span className="font-bold">{prog?.code || '??'}</span> - {mb.branch}
                            <button onClick={() => removeAssignment(user.id, mb.programId, mb.branch)}>
                              <X className="w-3 h-3 hover:text-red-500" />
                            </button>
                          </Badge>
                        );
                      })}
                      {(!user.managedBranches || user.managedBranches.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">No branches assigned</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {assigningUser === user.id ? (
                      <div className="flex items-end justify-end gap-2 animate-in slide-in-from-right-2">
                        <div className="text-left space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Program</Label>
                          <Select value={selection.programId} onValueChange={v => setSelection({...selection, programId: v, branch: ''})}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent>
                              {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="text-left space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Branch</Label>
                          <Select value={selection.branch} onValueChange={v => setSelection({...selection, branch: v})}>
                            <SelectTrigger className="w-32 h-8"><SelectValue placeholder="..." /></SelectTrigger>
                            <SelectContent>
                              {programs.find(p => p.id === selection.programId)?.branches?.map(b => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" onClick={() => handleAssign(user.id)} disabled={!selection.branch} className="h-8">Add</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAssigningUser(null)} className="h-8">Cancel</Button>
                      </div>
                    ) : (
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningUser(user.id)}>
                        <Plus className="w-4 h-4" /> Assign Branch
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {convenors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No active BoS Convenors found in the system.</p>
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
