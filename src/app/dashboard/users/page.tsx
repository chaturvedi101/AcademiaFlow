'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { UserProfile, Program, FACULTIES, FacultyName, UserRole } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, ShieldCheck, Plus, X, GraduationCap, Loader2, UserPlus, Edit3, Trash2, Hash } from 'lucide-react';
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
    programId: '',
    branch: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter to show academic staff. 
  const academicStaff = useMemo(() => {
    return users.filter(u => ['bos_convenor', 'dean_faculty', 'dean_academic', 'admin'].includes(u.role));
  }, [users]);

  const handleOpenDialog = (userToEdit?: UserProfile) => {
    if (userToEdit) {
      setEditingUser(userToEdit);
      setForm({
        email: userToEdit.email,
        displayName: userToEdit.displayName,
        role: userToEdit.role,
        faculty: userToEdit.faculty || '',
        programId: userToEdit.managedBranches?.[0]?.programId || '',
        branch: userToEdit.managedBranches?.[0]?.branch || ''
      });
    } else {
      setEditingUser(null);
      setForm({ email: '', displayName: '', role: 'bos_convenor', faculty: '', programId: '', branch: '' });
    }
    setIsDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!form.email || !form.displayName) {
      toast({ title: "Validation Error", description: "Email and Name are required.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);

    if (editingUser) {
      // Update existing user
      const userRef = doc(db, 'users', editingUser.id);
      
      // Conditionally build updates to avoid 'undefined' field errors in Firestore
      const updates: any = {
        displayName: form.displayName,
        role: form.role,
      };

      // Handle Faculty
      if (form.role === 'dean_faculty' || form.faculty === 'University-wide (Common BOS)') {
        if (form.faculty) {
          updates.faculty = form.faculty;
        }
      }

      // Handle Managed Branches
      if (form.role === 'bos_convenor' && form.programId && form.branch) {
        updates.managedBranches = [{ programId: form.programId, branch: form.branch }];
      } else if (form.role !== 'bos_convenor' && form.role !== 'bos_member') {
        updates.managedBranches = [];
      }

      updateDoc(userRef, updates)
        .then(() => {
          toast({ title: "Success", description: "Staff permissions updated." });
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
        };

        if (form.role === 'dean_faculty' || form.faculty === 'University-wide (Common BOS)') {
          if (form.faculty) {
            userData.faculty = form.faculty;
          }
        }

        if (form.role === 'bos_convenor' && form.programId && form.branch) {
          userData.managedBranches = [{ programId: form.programId, branch: form.branch }];
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

  const selectedProgram = programs.find(p => p.id === form.programId);

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-headline font-bold">Academic Staff Authorization</h1>
          <p className="text-muted-foreground">Manage Deans, Faculty Convenors, and University-wide BOS.</p>
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
          <CardDescription>Review and modify jurisdictional access for institutional leadership.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Personnel</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Jurisdiction</TableHead>
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
                      <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
                        <Hash className="w-2.5 h-2.5" /> {user.id}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase text-[10px] font-bold">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.faculty ? (
                      <Badge className="bg-primary/10 text-primary border-none text-[10px]">
                        {user.faculty}
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.managedBranches?.map((mb, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px] bg-muted/50">
                            {programs.find(p => p.id === mb.programId)?.code || '??'} - {mb.branch}
                          </Badge>
                        ))}
                        {(!user.managedBranches || user.managedBranches.length === 0) && (
                          <span className="text-[10px] text-muted-foreground italic">No branch assigned</span>
                        )}
                      </div>
                    )}
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit Staff Authorization' : 'Register Academic Staff'}</DialogTitle>
            <DialogDescription>
              {editingUser 
                ? `Updating permissions for ${editingUser.displayName}.` 
                : 'Create an account for a new academic leader. Default Password: abcd1234'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} disabled={!!editingUser} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Academic Role</Label>
              <Select value={form.role} onValueChange={(v: any) => setForm({...form, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dean_faculty">Dean of Faculty</SelectItem>
                  <SelectItem value="bos_convenor">BoS Convenor</SelectItem>
                  <SelectItem value="dean_academic">Dean Academic</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Assigned Faculty / Common Pool</Label>
              <Select value={form.faculty} onValueChange={(v: any) => setForm({...form, faculty: v})}>
                <SelectTrigger><SelectValue placeholder="Select faculty or common pool..." /></SelectTrigger>
                <SelectContent>
                  {FACULTIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.role === 'bos_convenor' && form.faculty !== 'University-wide (Common BOS)' && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1">
                <div className="space-y-2">
                  <Label>Primary Program</Label>
                  <Select value={form.programId} onValueChange={v => setForm({...form, programId: v, branch: ''})}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Initial Branch</Label>
                  <Select value={form.branch} onValueChange={v => setForm({...form, branch: v})}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {selectedProgram?.branches?.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isProcessing}>
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editingUser ? 'Save Changes' : 'Register Staff'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
