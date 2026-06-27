'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, Program, ManagedBranch } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Users, UserPlus, ShieldCheck, Loader2, Plus, X, GraduationCap } from 'lucide-react';
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

  const usersRef = useMemoFirebase(() => collection(db, 'users'), [db]);
  const { data: allUsers, loading: usersLoading } = useCollection<UserProfile>(usersRef);
  
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs } = useCollection<Program>(programsRef);

  const teamMembers = useMemo(() => {
    return allUsers.filter(u => ['bos_member', 'bos_convenor'].includes(u.role));
  }, [allUsers]);

  const [isRegisterDialogOpen, setIsRegisterDialogOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ 
    email: '', 
    displayName: '',
    managedBranches: [] as ManagedBranch[]
  });
  
  const [newAssignment, setNewAssignment] = useState<ManagedBranch>({
    programId: '',
    branch: '',
    role: 'bos_member'
  });

  const [isRegistering, setIsRegistering] = useState(false);

  // My branches where I am a Convenor
  const myConvenorBranches = useMemo(() => {
    if (profile?.role === 'admin' || profile?.role === 'dean_academic') {
       return programs.flatMap(p => p.branches.map(b => ({ programId: p.id, branch: b })));
    }
    return profile?.managedBranches?.filter(mb => mb.role === 'bos_convenor') || [];
  }, [profile, programs]);

  const handleAddAssignment = () => {
    if (!newAssignment.programId || !newAssignment.branch) return;
    
    const isDuplicate = registerForm.managedBranches.some(
      mb => mb.programId === newAssignment.programId && mb.branch === newAssignment.branch
    );

    if (isDuplicate) {
      toast({ title: "Assignment Exists", description: "This branch is already in the list.", variant: "destructive" });
      return;
    }

    setRegisterForm({
      ...registerForm,
      managedBranches: [...registerForm.managedBranches, { ...newAssignment }]
    });
    setNewAssignment({ programId: '', branch: '', role: 'bos_member' });
  };

  const handleRemoveAssignmentFromForm = (idx: number) => {
    setRegisterForm({
      ...registerForm,
      managedBranches: registerForm.managedBranches.filter((_, i) => i !== idx)
    });
  };

  const handleRegisterMember = async () => {
    if (!registerForm.email || !registerForm.displayName) {
      toast({ title: "Validation Error", description: "Email and Name are required.", variant: "destructive" });
      return;
    }

    if (registerForm.managedBranches.length === 0) {
      toast({ title: "Assignment Required", description: "Add at least one branch assignment.", variant: "destructive" });
      return;
    }

    setIsRegistering(true);

    const existingUser = allUsers.find(u => u.email.toLowerCase() === registerForm.email.toLowerCase());
    
    if (existingUser) {
      const userRef = doc(db, 'users', existingUser.id);
      
      // Merge unique branches
      const currentBranches = existingUser.managedBranches || [];
      const newBranches = [...currentBranches];

      registerForm.managedBranches.forEach(pending => {
        const index = newBranches.findIndex(b => b.programId === pending.programId && b.branch === pending.branch);
        if (index === -1) {
          newBranches.push(pending);
        } else {
          // Update role if different
          newBranches[index].role = pending.role;
        }
      });
      
      await updateDoc(userRef, { managedBranches: newBranches });
      toast({ title: "Assignments Synced", description: `Updated branch access for ${registerForm.displayName}'s institutional ID.` });
      setIsRegistering(false);
      setIsRegisterDialogOpen(false);
      return;
    }

    // CREATE new user
    let tempApp;
    try {
      const appName = `temp-member-${Date.now()}`;
      tempApp = initializeApp(firebaseConfig, appName);
      const tempAuth = getAuth(tempApp);
      
      const userCredential = await createUserWithEmailAndPassword(tempAuth, registerForm.email, "abcd1234");
      const newUid = userCredential.user.uid;

      const userRef = doc(db, 'users', newUid);
      
      const userData = {
        displayName: registerForm.displayName,
        email: registerForm.email,
        role: 'bos_member', // Initial primary role
        createdAt: serverTimestamp(),
        managedBranches: registerForm.managedBranches
      };

      await setDoc(userRef, userData);
      
      toast({ title: "Member Registered", description: `${registerForm.displayName} added to your BoS team with ${registerForm.managedBranches.length} assignments.` });
      setIsRegisterDialogOpen(false);
      setRegisterForm({ email: '', displayName: '', managedBranches: [] });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: error.message });
    } finally {
      setIsRegistering(false);
      if (tempApp) await deleteApp(tempApp);
    }
  };

  const handleRemoveAssignmentFromMember = (memberId: string, programId: string, branch: string) => {
    const member = teamMembers.find(u => u.id === memberId);
    if (!member) return;

    const managedBranches = member.managedBranches?.filter(mb => !(mb.programId === programId && mb.branch === branch)) || [];
    const memberRef = doc(db, 'users', memberId);

    updateDoc(memberRef, { managedBranches }).then(() => {
      toast({ title: "Access Revoked", description: `Branch assignment removed.` });
    });
  };

  const selectedProgramForNewAssignment = programs.find(p => p.id === newAssignment.programId);

  if (usersLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-headline font-bold">BoS Faculty Management</h1>
          <p className="text-muted-foreground">Identify members by email to sync their access across multiple Boards of Study.</p>
        </div>
        <Button onClick={() => {
          setRegisterForm({ email: '', displayName: '', managedBranches: [] });
          setIsRegisterDialogOpen(true);
        }} className="gap-2 shadow-lg">
          <UserPlus className="w-4 h-4" /> Add Team Member
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            BoS Network
          </CardTitle>
          <CardDescription>Collaborators assigned to your managed branches.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Personnel</TableHead>
                <TableHead>Institutional Assignments</TableHead>
                <TableHead className="text-right pr-6">Management</TableHead>
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
                        const isMyJurisdiction = myConvenorBranches.some(my => my.programId === mb.programId && my.branch === mb.branch);
                        
                        return (
                          <Badge key={idx} variant="outline" className={`gap-2 py-1 ${isMyJurisdiction ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 opacity-50'}`}>
                            <span className="font-bold">{prog?.code || '??'}</span> - {mb.branch}
                            <span className="text-[8px] font-black uppercase text-accent">({(mb.role || 'bos_member').split('_')[1] || 'member'})</span>
                            {isMyJurisdiction && (
                              <X className="w-3 h-3 text-red-400 cursor-pointer hover:text-red-600" onClick={() => handleRemoveAssignmentFromMember(member.id, mb.programId, mb.branch)} />
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                     <p className="text-[10px] text-muted-foreground italic">Identified by institutional ID</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isRegisterDialogOpen} onOpenChange={setIsRegisterDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Assign Faculty Member</DialogTitle>
            <DialogDescription>
              Enter the member's email. You can assign them to multiple branches where you are a Convenor.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Institutional Email</Label>
                <Input type="email" placeholder="faculty@rtu.ac.in" value={registerForm.email} onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input placeholder="Member Name" value={registerForm.displayName} onChange={(e) => setRegisterForm({ ...registerForm, displayName: e.target.value })} />
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-4 bg-muted/20">
              <Label className="font-bold flex items-center gap-2 text-primary">
                <GraduationCap className="w-4 h-4" /> 
                Assignments Builder
              </Label>
              
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Branch Under Your Jurisdiction</Label>
                  <Select onValueChange={v => {
                     const found = myConvenorBranches.find(b => b.branch === v);
                     setNewAssignment({...newAssignment, programId: found?.programId || '', branch: v});
                  }}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select a branch..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myConvenorBranches.map((mb, idx) => {
                        const prog = programs.find(p => p.id === mb.programId);
                        return (
                          <SelectItem key={idx} value={mb.branch}>
                            {prog?.code} - {mb.branch}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Role</Label>
                  <Select value={newAssignment.role} onValueChange={(v: any) => setNewAssignment({...newAssignment, role: v})}>
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bos_member">Member</SelectItem>
                      <SelectItem value="bos_convenor">Convenor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Button type="button" size="icon" className="h-10 w-10" onClick={handleAddAssignment} disabled={!newAssignment.branch}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 min-h-[40px]">
                {registerForm.managedBranches.map((mb, idx) => (
                  <Badge key={idx} className="h-8 gap-2 bg-white text-foreground border-primary/20">
                    {programs.find(p => p.id === mb.programId)?.code} - {mb.branch} ({(mb.role || 'bos_member').split('_')[1] || 'member'})
                    <X className="w-3.5 h-3.5 cursor-pointer text-red-400 hover:text-red-600" onClick={() => handleRemoveAssignmentFromForm(idx)} />
                  </Badge>
                ))}
                {registerForm.managedBranches.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic w-full text-center py-2">No branches added yet.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRegisterDialogOpen(false)} disabled={isRegistering}>Cancel</Button>
            <Button onClick={handleRegisterMember} disabled={isRegistering || registerForm.managedBranches.length === 0}>
              {isRegistering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Sync Institutional Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
