
'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { UserProfile, Program, FACULTIES, FacultyName, UserRole, ManagedBranch } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, ShieldCheck, Plus, GraduationCap, Loader2, UserPlus, Edit3, Trash2, Hash, X, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

export default function UserManagementPage() {
  const db = useFirestore();
  const { toast } = useToast();
  const { user: currentUser } = useUser();

  const userDocRef = useMemoFirebase(() => (currentUser ? doc(db, 'users', currentUser.uid) : null), [db, currentUser]);
  const { data: myProfile } = useDoc<UserProfile>(userDocRef);

  const usersRef = useMemoFirebase(() => collection(db, 'users'), [db]);
  const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersRef);
  const { data: programs } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ 
    email: '', 
    displayName: '',
    role: 'bos_convenor' as UserRole,
    faculty: '' as FacultyName | '',
    managedBranches: [] as ManagedBranch[]
  });
  
  const [newAssignment, setNewAssignment] = useState<ManagedBranch>({ programId: '', branch: '', role: 'bos_member' });
  const [isProcessing, setIsProcessing] = useState(false);

  const academicStaff = useMemo(() => {
    return users.filter(u => ['bos_convenor', 'bos_member', 'dean_faculty', 'dean_academic', 'admin', 'monitor', 'committee_convenor'].includes(u.role));
  }, [users]);

  const handleOpenDialog = (userToEdit?: UserProfile) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setForm({
        email: userToEdit.email,
        displayName: userToEdit.displayName,
        role: userToEdit.role,
        faculty: userToEdit.faculty || '',
        managedBranches: userToEdit.managedBranches || []
      });
    } else {
      setEditingUser(null);
      setForm({ email: '', displayName: '', role: 'bos_convenor', faculty: '', managedBranches: [] });
    }
    setIsDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!form.email || !form.displayName) return;
    setIsProcessing(true);

    try {
      const existingUser = users.find(u => u.email.toLowerCase() === form.email.toLowerCase());
      const targetId = editingUser?.id || existingUser?.id;

      if (targetId) {
        const userRef = doc(db, 'users', targetId);
        await updateDoc(userRef, { 
          displayName: form.displayName, 
          role: form.role, 
          faculty: form.faculty || null,
          managedBranches: form.managedBranches 
        });
      } else {
        const tempApp = initializeApp(firebaseConfig, `temp-${Date.now()}`);
        const tempAuth = getAuth(tempApp);
        const res = await createUserWithEmailAndPassword(tempAuth, form.email, "abcd1234");
        await setDoc(doc(db, 'users', res.user.uid), {
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          faculty: form.faculty || null,
          managedBranches: form.managedBranches,
          createdAt: serverTimestamp()
        });
        await deleteApp(tempApp);
      }
      toast({ title: "Authorized", description: "Academic permissions updated." });
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-headline font-bold">Academic Staff Authorization</h1>
        <Button onClick={() => handleOpenDialog()} className="gap-2 shadow-lg"><UserPlus className="w-4 h-4" /> Register Staff</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Personnel</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Assigned Committee / Faculty</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {academicStaff.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-6 font-bold">{u.displayName}<p className="text-[10px] text-muted-foreground font-normal">{u.email}</p></TableCell>
                  <TableCell><Badge variant="outline" className="uppercase text-[9px]">{u.role.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>{u.faculty || <span className="text-muted-foreground italic text-xs">Branch Specific</span>}</TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(u)}><Edit3 className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="text-red-400" onClick={() => deleteDoc(doc(db, 'users', u.id))}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Academic Permissions</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Full Name</Label><Input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} /></div>
              <div className="space-y-2"><Label>Institutional Email</Label><Input value={form.email} disabled={!!editingUser} onChange={e => setForm({...form, email: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="committee_convenor">Course Committee Convenor</SelectItem>
                    <SelectItem value="bos_convenor">Branch BoS Convenor</SelectItem>
                    <SelectItem value="dean_faculty">Dean of Faculty</SelectItem>
                    <SelectItem value="dean_academic">Dean Academic</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned Vertical / Committee</Label>
                <Select value={form.faculty} onValueChange={(v: any) => setForm({...form, faculty: v})}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {FACULTIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSaveUser} disabled={isProcessing}>Save Authorization</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
