
'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Program, FACULTIES, FacultyName } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, ShieldCheck, Plus, X, GraduationCap, Loader2, UserPlus } from 'lucide-react';
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

  const usersRef = useMemoFirebase(() => collection(db, 'users'), [db]);
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);

  const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersRef);
  const { data: programs } = useCollection<Program>(programsRef);
  
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ 
    email: '', 
    displayName: '',
    role: 'bos_convenor' as UserProfile['role'],
    faculty: '' as FacultyName | '',
    programId: '',
    branch: ''
  });
  const [isRegistering, setIsRegistering] = useState(false);

  const academicStaff = users.filter(u => ['bos_convenor', 'dean_faculty'].includes(u.role));

  const handleRegisterUser = async () => {
    if (!registerForm.email || !registerForm.displayName) {
      toast({ title: "Validation Error", description: "Email and Name are required.", variant: "destructive" });
      return;
    }

    if (registerForm.role === 'dean_faculty' && !registerForm.faculty) {
      toast({ title: "Validation Error", description: "Dean Faculty must be assigned a Faculty.", variant: "destructive" });
      return;
    }

    setIsRegistering(true);
    let tempApp;
    try {
      const appName = `temp-admin-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getAuth(tempApp);
      
      const userCredential = await createUserWithEmailAndPassword(tempAuth, registerForm.email, "abcd1234");
      const newUid = userCredential.user.uid;

      const userRef = doc(db, 'users', newUid);
      
      const userData: Partial<UserProfile> = {
        displayName: registerForm.displayName,
        email: registerForm.email,
        role: registerForm.role,
        createdAt: serverTimestamp() as any,
      };

      if (registerForm.role === 'dean_faculty') {
        userData.faculty = registerForm.faculty as FacultyName;
      } else if (registerForm.role === 'bos_convenor' && registerForm.programId && registerForm.branch) {
        userData.managedBranches = [{ programId: registerForm.programId, branch: registerForm.branch }];
      }

      await setDoc(userRef, userData);
      
      toast({ 
        title: "Account Created", 
        description: `${registerForm.displayName} registered successfully. Password: abcd1234` 
      });
      setIsRegisterDialogOpen(false);
      setRegisterForm({ email: '', displayName: '', role: 'bos_convenor', faculty: '', programId: '', branch: '' });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: error.message });
    } finally {
      setIsRegistering(false);
      if (tempApp) await deleteApp(tempApp);
    }
  };

  const selectedRegisterProgram = programs.find(p => p.id === registerForm.programId);

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-headline font-bold">Academic Staff Authorization</h1>
          <p className="text-muted-foreground">Manage Deans and BoS Convenors across university faculties.</p>
        </div>
        <Button onClick={() => setIsRegisterDialogOpen(true)} className="gap-2 shadow-lg">
          <UserPlus className="w-4 h-4" /> Register Staff
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Academic Personnel
          </CardTitle>
          <CardDescription>Review authorizations for faculty leadership and convenors.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Personnel Details</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Jurisdiction</TableHead>
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
                    <Badge variant="secondary" className="uppercase text-[10px]">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.role === 'dean_faculty' ? (
                      <Badge className="bg-primary/10 text-primary border-none text-[10px]">
                        {user.faculty}
                      </Badge>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {user.managedBranches?.map((mb, idx) => (
                          <Badge key={idx} variant="outline" className="text-[10px]">
                            {programs.find(p => p.id === mb.programId)?.code} - {mb.branch}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Academic Staff</DialogTitle>
            <DialogDescription>Create account for Dean or BoS Convenor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={registerForm.displayName} onChange={e => setRegisterForm({...registerForm, displayName: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={registerForm.email} onChange={e => setRegisterForm({...registerForm, email: e.target.value})} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Academic Role</Label>
              <Select value={registerForm.role} onValueChange={(v: any) => setRegisterForm({...registerForm, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dean_faculty">Dean of Faculty</SelectItem>
                  <SelectItem value="bos_convenor">BoS Convenor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {registerForm.role === 'dean_faculty' && (
              <div className="space-y-2">
                <Label>Assigned Faculty</Label>
                <Select value={registerForm.faculty} onValueChange={(v: any) => setRegisterForm({...registerForm, faculty: v})}>
                  <SelectTrigger><SelectValue placeholder="Select faculty..." /></SelectTrigger>
                  <SelectContent>
                    {FACULTIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {registerForm.role === 'bos_convenor' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Initial Program</Label>
                  <Select onValueChange={v => setRegisterForm({...registerForm, programId: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Initial Branch</Label>
                  <Select onValueChange={v => setRegisterForm({...registerForm, branch: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {selectedRegisterProgram?.branches?.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegisterDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRegisterUser} disabled={isRegistering}>Register Staff Member</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
