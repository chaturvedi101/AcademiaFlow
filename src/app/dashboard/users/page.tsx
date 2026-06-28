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
import { Users, ShieldCheck, Plus, GraduationCap, Loader2, UserPlus, Edit3, Trash2, Hash, X } from 'lucide-react';
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
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);

  const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersRef);
  const { data: programs } = useCollection<Program>(programsRef);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ 
    email: '', 
    displayName: '',
    role: 'bos_convenor' as UserRole,
    faculty: '' as FacultyName | '',
    managedBranches: [] as ManagedBranch[]
  });
  
  const [newAssignment, setNewAssignment] = useState<ManagedBranch>({
    programId: '',
    branch: '',
    role: 'bos_member'
  });

  const [isProcessing, setIsProcessing] = useState(false);

  const academicStaff = useMemo(() => {
    return users.filter(u => ['bos_convenor', 'bos_member', 'dean_faculty', 'dean_academic', 'admin', 'monitor'].includes(u.role));
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

  const handleAddAssignment = () => {
    if (!newAssignment.programId || !newAssignment.branch) return;
    setForm({
      ...form,
      managedBranches: [...form.managedBranches, { ...newAssignment }]
    });
    setNewAssignment({ programId: '', branch: '', role: 'bos_member' });
  };

  const handleRemoveAssignment = (idx: number) => {
    setForm({
      ...form,
      managedBranches: form.managedBranches.filter((_, i) => i !== idx)
    });
  };

  const handleSaveUser = async () => {
    if (!form.email || !form.displayName) {
      toast({ title: "Validation Error", description: "Email and Name are required.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    const existingUser = users.find(u => u.email.toLowerCase() === form.email.toLowerCase());
    
    if (editingUser || existingUser) {
      const targetId = editingUser?.id || existingUser?.id;
      const userRef = doc(db, 'users', targetId!);
      
      const updates: any = {
        displayName: form.displayName,
        role: form.role,
        managedBranches: form.managedBranches
      };

      if (form.role === 'dean_faculty' || form.faculty === 'University-wide (Common BOS)') {
        updates.faculty = form.faculty || null;
      } else {
        updates.faculty = null;
      }

      updateDoc(userRef, updates)
        .then(() => {
          toast({ title: "Success", description: `Permissions updated for ${form.displayName}.` });
          setIsDialogOpen(false);
        })
        .catch(err => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: userRef.path,
            operation: 'update',
            requestResourceData: updates
          }));
        })
        .finally(() => setIsProcessing(false));

    } else {
      // Register new user
      let tempApp;
      try {
        const appName = `temp-admin-${Date.now()}`;
        tempApp = initializeApp(firebaseConfig, appName);
        const tempAuth = getAuth(tempApp);
        
        const userCredential = await createUserWithEmailAndPassword(tempAuth, form.email, "abcd1234");
        const newUid = userCredential.user.uid;

        const userRef = doc(db, 'users', newUid);
        
        const userData: any = {
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          createdAt: serverTimestamp(),
          managedBranches: form.managedBranches
        };

        if (form.role === 'dean_faculty' || form.faculty === 'University-wide (Common BOS)') {
          userData.faculty = form.faculty || null;
        }

        await setDoc(userRef, userData);
        
        toast({ 
          title: "Account Created", 
          description: `${form.displayName} registered successfully. Default Password: abcd1234` 
        });
        setIsDialogOpen(false);
      } catch (error: any) {
        toast({ variant: "destructive", title: "Registration Failed", description: error.message });
      } finally {
        setIsProcessing(false);
        if (tempApp) await deleteApp(tempApp);
      }
    }
  };

  const handleDeleteUser = (uid: string) => {
    if (uid === currentUser?.uid) {
      toast({ title: "Operation Denied", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }

    const userRef = doc(db, 'users', uid);
    deleteDoc(userRef).then(() => {
      toast({ title: "User Removed", description: "Academic staff member has been deleted." });
    }).catch(err => {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userRef.path,
        operation: 'delete'
      }));
    });
  };

  const selectedProgram = programs.find(p => p.id === newAssignment.programId);

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-headline font-bold">Academic Staff Authorization</h1>
          <p className="text-muted-foreground">Manage Deans, Faculty Convenors, and University-wide BOS members via email identification.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 shadow-lg">
          <UserPlus className="w-4 h-4" /> Register Staff
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Active Authorization Matrix
          </CardTitle>
          <CardDescription>Jurisdictional access for institutional leadership.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Personnel</TableHead>
                <TableHead>Primary Role</TableHead>
                <TableHead>Jurisdiction Assignments</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {academicStaff.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="pl-6">
                    <div className="space-y-1">
                      <p className="font-bold">{user.displayName}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] font-bold">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-2">
                      {user.faculty && (
                        <Badge className="bg-primary/10 text-primary border-none text-[10px] w-fit">
                          {user.faculty}
                        </Badge>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {user.managedBranches?.map((mb, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] bg-muted/50 gap-2">
                            {programs.find(p => p.id === mb.programId)?.code || '??'} - {mb.branch}
                            <span className="text-[8px] font-black uppercase text-accent">({(mb.role || 'bos_member').split('_')[1] || 'member'})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(user)}>
                        <Edit3 className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDeleteUser(user.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
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
            <DialogTitle>{editingUser ? 'Edit Staff Authorization' : 'Register Academic Staff'}</DialogTitle>
            <DialogDescription>
              Accounts are identified by email. Adding an existing email will update their current permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email (Institutional ID)</Label>
                <Input type="email" value={form.email} disabled={!!editingUser} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Primary Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm({...form, role: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dean_faculty">Dean of Faculty</SelectItem>
                    <SelectItem value="bos_convenor">BoS Staff (Multi-BOS)</SelectItem>
                    <SelectItem value="dean_academic">Dean Academic</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="monitor">Monitor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Assigned Faculty / Common Pool</Label>
                <Select value={form.faculty || 'none'} onValueChange={(v: any) => setForm({...form, faculty: v === 'none' ? '' : v})}>
                  <SelectTrigger><SelectValue placeholder="None / Branch-Specific" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Branch Based Only)</SelectItem>
                    {FACULTIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <Label className="font-bold flex items-center gap-2"><GraduationCap className="w-4 h-4" /> Branch-Specific BOS Access</Label>
              
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-1">
                  <Label className="text-[10px] uppercase font-bold">Program</Label>
                  <Select value={newAssignment.programId} onValueChange={v => setNewAssignment({...newAssignment, programId: v, branch: ''})}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-[10px] uppercase font-bold">Branch</Label>
                  <Select value={newAssignment.branch} onValueChange={v => setNewAssignment({...newAssignment, branch: v})}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{selectedProgram?.branches?.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-[10px] uppercase font-bold">Role</Label>
                  <Select value={newAssignment.role} onValueChange={(v: any) => setNewAssignment({...newAssignment, role: v})}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bos_convenor">Convenor</SelectItem>
                      <SelectItem value="bos_member">Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Button size="sm" onClick={handleAddAssignment} disabled={!newAssignment.branch}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                {form.managedBranches.map((mb, idx) => (
                  <Badge key={idx} className="h-8 gap-2 bg-white text-foreground border-border">
                    {programs.find(p => p.id === mb.programId)?.code} - {mb.branch} ({(mb.role || 'bos_member').split('_')[1] || 'member'})
                    <X className="w-3 h-3 cursor-pointer text-red-400" onClick={() => handleRemoveAssignment(idx)} />
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isProcessing}>
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Authorization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
