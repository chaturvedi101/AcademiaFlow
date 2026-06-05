'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { UserProfile, Program, ManagedBranch } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, X, ShieldCheck, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { firebaseConfig } from "@/firebase/config";

export default function TeamManagementPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  // Get all users who are bos_members (BOS Convenors manage BoS Members)
  const usersRef = useMemoFirebase(() => collection(db, 'users'), [db]);
  const { data: allUsers, loading: usersLoading } = useCollection<UserProfile>(usersRef);
  
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs } = useCollection<Program>(programsRef);

  const teamMembers = useMemo(() => {
    return allUsers.filter(u => u.role === 'bos_member');
  }, [allUsers]);

  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [selection, setSelection] = useState({ programId: '', branch: '' });
  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ 
    email: '', 
    displayName: '',
    programId: '',
    branch: ''
  });
  const [isRegistering, setIsRegistering] = useState(false);

  // Convenor can only assign branches they manage
  const availableManagedBranches = profile?.managedBranches || [];

  const handleRegisterMember = async () => {
    if (!registerForm.email || !registerForm.displayName) {
      toast({ title: "Validation Error", description: "Email and Name are required.", variant: "destructive" });
      return;
    }

    setIsRegistering(true);
    let tempApp;
    try {
      const appName = `temp-member-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getAuth(tempApp);
      
      const userCredential = await createUserWithEmailAndPassword(tempAuth, registerForm.email, "abcd1234");
      const newUid = userCredential.user.uid;

      const userRef = doc(db, 'users', newUid);
      
      const initialBranches: ManagedBranch[] = [];
      if (registerForm.programId && registerForm.branch) {
        initialBranches.push({
          programId: registerForm.programId,
          branch: registerForm.branch
        });
      }

      const userData = {
        displayName: registerForm.displayName,
        email: registerForm.email,
        role: 'bos_member',
        createdAt: serverTimestamp(),
        managedBranches: initialBranches
      };

      await setDoc(userRef, userData);
      
      toast({ 
        title: "Member Registered", 
        description: `${registerForm.displayName} added to your BoS team. Password: abcd1234` 
      });
      setIsRegisterDialogOpen(false);
      setRegisterForm({ email: '', displayName: '', programId: '', branch: '' });
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Registration Failed", 
        description: error.message || "An error occurred." 
      });
    } finally {
      setIsRegistering(false);
      if (tempApp) {
        await deleteApp(tempApp);
      }
    }
  };

  const handleAssign = (userId: string) => {
    if (!selection.programId || !selection.branch) return;

    const targetUser = teamMembers.find(u => u.id === userId);
    if (!targetUser) return;

    const managedBranches = [...(targetUser.managedBranches || []), { ...selection }];
    const targetUserRef = doc(db, 'users', userId);

    updateDoc(targetUserRef, { managedBranches })
      .then(() => {
        toast({ title: "Permission Assigned", description: "Branch access updated." });
        setAssigningUser(null);
        setSelection({ programId: '', branch: '' });
      })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: targetUserRef.path,
          operation: 'update',
          requestResourceData: { managedBranches }
        }));
      });
  };

  const removeAssignment = (userId: string, programId: string, branch: string) => {
    const targetUser = teamMembers.find(u => u.id === userId);
    if (!targetUser) return;

    const managedBranches = targetUser.managedBranches?.filter(b => !(b.programId === programId && b.branch === branch));
    const targetUserRef = doc(db, 'users', userId);

    updateDoc(targetUserRef, { managedBranches })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: targetUserRef.path,
          operation: 'update'
        }));
      });
  };

  const handleDeleteMember = (memberId: string) => {
    const targetUserRef = doc(db, 'users', memberId);
    deleteDoc(targetUserRef)
      .then(() => {
        toast({ title: "Member Removed", description: "The BoS member's profile and permissions have been deleted." });
      })
      .catch(err => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: targetUserRef.path,
          operation: 'delete'
        }));
      });
  };

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-headline font-bold">My BoS Team</h1>
          <p className="text-muted-foreground">Manage BoS Members and delegate subject-level tasks.</p>
        </div>
        <Button onClick={() => setIsRegisterDialogOpen(true)} className="gap-2 shadow-lg">
          <UserPlus className="w-4 h-4" /> Add Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            BoS Members
          </CardTitle>
          <CardDescription>Members can edit syllabi but cannot change scheme layouts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Member Name</TableHead>
                <TableHead>Assigned Branches</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teamMembers.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="pl-6">
                    <div className="space-y-1">
                      <p className="font-bold">{member.displayName}</p>
                      <p className="text-xs text-muted-foreground">{member.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {member.managedBranches?.map((mb, idx) => {
                        const prog = programs.find(p => p.id === mb.programId);
                        return (
                          <Badge key={idx} variant="outline" className="gap-2 bg-primary/5 border-primary/20 text-xs py-1">
                            <span className="font-bold">{prog?.code || '??'}</span> - {mb.branch}
                            <button onClick={() => removeAssignment(member.id, mb.programId, mb.branch)}>
                              <X className="w-3 h-3 hover:text-red-500" />
                            </button>
                          </Badge>
                        );
                      })}
                      {(!member.managedBranches || member.managedBranches.length === 0) && (
                        <span className="text-xs text-muted-foreground italic">No branches delegated</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    {assigningUser === member.id ? (
                      <div className="flex items-end justify-end gap-2 animate-in slide-in-from-right-2">
                        <div className="text-left space-y-1">
                          <Label className="text-[10px] uppercase font-bold">Delegate Branch</Label>
                          <Select value={selection.branch} onValueChange={v => {
                            const found = availableManagedBranches.find(b => b.branch === v);
                            setSelection({ programId: found?.programId || '', branch: v });
                          }}>
                            <SelectTrigger className="w-48 h-8"><SelectValue placeholder="Select..." /></SelectTrigger>
                            <SelectContent>
                              {availableManagedBranches.map((mb, idx) => (
                                <SelectItem key={idx} value={mb.branch}>{mb.branch}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button size="sm" onClick={() => handleAssign(member.id)} disabled={!selection.branch} className="h-8">Assign</Button>
                        <Button size="sm" variant="ghost" onClick={() => setAssigningUser(null)} className="h-8">Cancel</Button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setAssigningUser(member.id)}>
                          <Plus className="w-4 h-4" /> Delegate Access
                        </Button>
                        <Button variant="ghost" size="icon" className="text-red-400 hover:text-red-500 hover:bg-red-50" onClick={() => handleDeleteMember(member.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {teamMembers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>You haven't added any BoS members yet.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Faculty Member</DialogTitle>
            <DialogDescription>
              Create a BoS Member account. Password: <span className="font-bold text-primary">abcd1234</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input 
                placeholder="Name" 
                value={registerForm.displayName}
                onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input 
                type="email" 
                placeholder="faculty@university.edu" 
                value={registerForm.email}
                onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Initial Branch Delegation</Label>
              <Select onValueChange={v => {
                 const found = availableManagedBranches.find(b => b.branch === v);
                 setRegisterForm({...registerForm, programId: found?.programId || '', branch: v});
              }}>
                <SelectTrigger><SelectValue placeholder="Select one of your branches..." /></SelectTrigger>
                <SelectContent>
                  {availableManagedBranches.map((mb, idx) => (
                    <SelectItem key={idx} value={mb.branch}>{mb.branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegisterDialogOpen(false)} disabled={isRegistering}>Cancel</Button>
            <Button onClick={handleRegisterMember} disabled={isRegistering}>
              {isRegistering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Register Member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
