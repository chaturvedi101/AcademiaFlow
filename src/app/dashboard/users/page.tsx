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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, ShieldCheck, Plus, GraduationCap, Loader2, UserPlus, Edit3, Trash2, Hash, X, ShieldAlert, Layers, Search, BookOpen } from 'lucide-react';
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
  
  const programsRef = useMemoFirebase(() => collection(db, 'programs'), [db]);
  const { data: programs, loading: programsLoading } = useCollection<Program>(programsRef);
  
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

  const isAdminOrDean = myProfile?.role === 'admin' || myProfile?.role === 'dean_academic' || myProfile?.role === 'monitor';

  const academicStaff = useMemo(() => {
    return users.filter(u => ['bos_convenor', 'bos_member', 'dean_faculty', 'dean_academic', 'admin', 'monitor', 'committee_convenor'].includes(u.role));
  }, [users]);

  // JURISDICTION MATRIX LOGIC
  const jurisdictionMatrix = useMemo(() => {
    if (!isAdminOrDean || !programs.length || !users.length) return [];

    const matrix: any[] = [];

    // 1. Program Branches
    programs.forEach(p => {
      p.branches.forEach(b => {
        const convenors = users.filter(u => u.managedBranches?.some(mb => mb.programId === p.id && mb.branch === b && mb.role === 'bos_convenor'));
        const members = users.filter(u => u.managedBranches?.some(mb => mb.programId === p.id && mb.branch === b && mb.role === 'bos_member'));
        matrix.push({
          type: 'branch',
          label: `${p.code} - ${b}`,
          faculty: p.faculty,
          convenors,
          members
        });
      });
    });

    // 2. Course Committees
    FACULTIES.filter(f => f.startsWith('Course Committee')).forEach(c => {
      const convenors = users.filter(u => (u.faculty === c && u.role === 'committee_convenor') || u.managedBranches?.some(mb => mb.branch === c && mb.role === 'bos_convenor'));
      const members = users.filter(u => (u.faculty === c && u.role === 'bos_member') || u.managedBranches?.some(mb => mb.branch === c && mb.role === 'bos_member'));
      matrix.push({
        type: 'committee',
        label: c,
        faculty: 'Institutional Pool',
        convenors,
        members
      });
    });

    return matrix;
  }, [isAdminOrDean, programs, users]);

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
    if (!newAssignment.programId || !newAssignment.branch) {
      toast({ title: "Validation Error", description: "Select both Program and Branch.", variant: "destructive" });
      return;
    }
    const isDuplicate = form.managedBranches.some(b => b.programId === newAssignment.programId && b.branch === newAssignment.branch);
    if (isDuplicate) {
      toast({ title: "Duplicate Assignment", description: "This branch is already assigned.", variant: "destructive" });
      return;
    }
    setForm({ ...form, managedBranches: [...form.managedBranches, { ...newAssignment }] });
    setNewAssignment({ programId: '', branch: '', role: 'bos_member' });
  };

  const handleRemoveAssignment = (idx: number) => {
    setForm({ ...form, managedBranches: form.managedBranches.filter((_, i) => i !== idx) });
  };

  const handleSaveUser = async () => {
    if (!form.email || !form.displayName) {
      toast({ title: "Validation Error", description: "Name and Email are required.", variant: "destructive" });
      return;
    }
    setIsProcessing(true);

    try {
      const existingUser = users.find(u => u.email.toLowerCase() === form.email.toLowerCase());
      const targetId = editingUser?.id || existingUser?.id;

      let primaryRole = form.role;
      if (form.managedBranches.some(b => b.role === 'bos_convenor') && primaryRole === 'bos_member') {
         primaryRole = 'bos_convenor';
      }

      if (targetId) {
        const userRef = doc(db, 'users', targetId);
        await updateDoc(userRef, { 
          displayName: form.displayName, 
          role: primaryRole, 
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
          role: primaryRole,
          faculty: form.faculty || null,
          managedBranches: form.managedBranches,
          createdAt: serverTimestamp()
        });
        await deleteApp(tempApp);
      }
      toast({ title: "Authorization Updated", description: `Permissions synced for ${form.displayName}.` });
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Operation Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  if (usersLoading || programsLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">Academic Staff Authorization</h1>
          <p className="text-muted-foreground">Authorize university personnel and assign BoS jurisdictions across all branches.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2 shadow-lg"><UserPlus className="w-4 h-4" /> Register Staff</Button>
      </div>

      <Tabs defaultValue={isAdminOrDean ? "matrix" : "personnel"} className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="personnel" className="gap-2"><Users className="w-4 h-4" /> Personnel Directory</TabsTrigger>
          {isAdminOrDean && (
            <TabsTrigger value="matrix" className="gap-2"><Layers className="w-4 h-4" /> Institutional Matrix</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="personnel">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/20">
                  <TableRow>
                    <TableHead className="pl-6">Personnel</TableHead>
                    <TableHead>Primary Role</TableHead>
                    <TableHead>Jurisdictional Assignments</TableHead>
                    <TableHead className="text-right pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {academicStaff.map((u) => (
                    <TableRow key={u.id} className="group hover:bg-muted/10 transition-colors">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm">{u.displayName}</span>
                          <span className="text-[10px] text-muted-foreground">{u.email}</span>
                          {u.faculty && (
                            <Badge variant="outline" className="mt-1.5 w-fit text-[8px] bg-primary/5 text-primary border-primary/20 font-bold px-1.5 py-0">
                              {u.faculty}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="uppercase text-[9px] font-black tracking-tight px-2 py-0.5">
                          {u.role.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5 max-w-md">
                          {u.managedBranches?.map((mb, idx) => {
                            const prog = programs.find(p => p.id === mb.programId);
                            return (
                              <Badge key={idx} variant="outline" className="text-[8px] py-0 bg-muted/30 border-muted-foreground/20">
                                <span className="font-black mr-1">{prog?.code || '??'}</span>
                                {mb.branch} 
                                <span className="ml-1 text-accent font-black">({(mb.role||'').split('_')[1] || 'member'})</span>
                              </Badge>
                            );
                          })}
                          {(!u.managedBranches || u.managedBranches.length === 0) && <span className="text-muted-foreground italic text-[10px]">No active branch assignments</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(u)}><Edit3 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => deleteDoc(doc(db, 'users', u.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="matrix">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 border-b">
              <CardTitle className="text-lg flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Institutional Jurisdictional Matrix
              </CardTitle>
              <CardDescription>Comprehensive audit of Board of Studies (BoS) assignments across all university technical tiers.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="pl-6 w-[300px]">Program / Committee Scope</TableHead>
                    <TableHead>Faculty Purview</TableHead>
                    <TableHead>BoS Convenor(s)</TableHead>
                    <TableHead>BoS Member(s)</TableHead>
                    <TableHead className="text-right pr-6 w-[100px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jurisdictionMatrix.map((item, idx) => (
                    <TableRow key={idx} className="group hover:bg-muted/5">
                      <TableCell className="pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "p-2 rounded-lg",
                            item.type === 'branch' ? "bg-primary/5" : "bg-emerald-50"
                          )}>
                            {item.type === 'branch' ? <GraduationCap className="w-4 h-4 text-primary" /> : <BookOpen className="w-4 h-4 text-emerald-700" />}
                          </div>
                          <div>
                            <p className="font-bold text-sm leading-none mb-1">{item.label}</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">{item.type.toUpperCase()}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] py-0">{item.faculty}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {item.convenors.map((c: any) => (
                            <div key={c.id} className="text-xs font-bold text-primary flex items-center gap-1.5">
                              <ShieldCheck className="w-3 h-3" /> {c.displayName}
                            </div>
                          ))}
                          {item.convenors.length === 0 && <span className="text-[10px] text-red-400 italic">No Convenor assigned</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {item.members.map((m: any) => (
                            <Badge key={m.id} variant="secondary" className="text-[10px] bg-white border h-6">
                              {m.displayName}
                            </Badge>
                          ))}
                          {item.members.length === 0 && <span className="text-[10px] text-muted-foreground italic">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {item.convenors.length > 0 ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-none text-[8px] font-black uppercase">ACTIVE</Badge>
                        ) : (
                          <Badge variant="outline" className="text-red-400 border-red-200 text-[8px] font-black uppercase">VACANT</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Institutional Authorization
            </DialogTitle>
            <DialogDescription>Assign academic roles and map personnel to their respective Boards of Study.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Full Legal Name</Label>
                <Input value={form.displayName} onChange={e => setForm({...form, displayName: e.target.value})} placeholder="Dr. Member Name" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Institutional Email</Label>
                <Input value={form.email} disabled={!!editingUser} onChange={e => setForm({...form, email: e.target.value})} placeholder="member@rtu.ac.in" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Primary Functional Role</Label>
                <Select value={form.role} onValueChange={(v: any) => setForm({...form, role: v})}>
                  <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bos_convenor">BoS Convenor</SelectItem>
                    <SelectItem value="bos_member">BoS Member</SelectItem>
                    <SelectItem value="committee_convenor">Course Committee Convenor</SelectItem>
                    <SelectItem value="dean_faculty">Dean of Faculty</SelectItem>
                    <SelectItem value="dean_academic">Dean Academic</SelectItem>
                    <SelectItem value="monitor">Academic Monitor</SelectItem>
                    <SelectItem value="admin">System Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Assigned Faculty / Common BoS</Label>
                <Select value={form.faculty} onValueChange={(v: any) => setForm({...form, faculty: v})}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Select faculty assignment..." /></SelectTrigger>
                  <SelectContent>
                    {FACULTIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border rounded-xl p-4 bg-muted/20 shadow-inner">
              <Label className="font-bold flex items-center gap-2 text-primary">
                <GraduationCap className="w-4 h-4" /> 
                BoS Assignment Builder
              </Label>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">1. Select Program / Committee</Label>
                  <Select value={newAssignment.programId} onValueChange={v => setNewAssignment({...newAssignment, programId: v, branch: ''})}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Select Program..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COMMITTEE">Institutional Committee Pool</SelectItem>
                      {programs.map(p => <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">2. Select Branch / Pool</Label>
                  <Select value={newAssignment.branch} onValueChange={v => setNewAssignment({...newAssignment, branch: v})} disabled={!newAssignment.programId}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Branch..." /></SelectTrigger>
                    <SelectContent>
                      {newAssignment.programId === 'COMMITTEE' ? (
                        FACULTIES.filter(f => f.startsWith('Course Committee')).map(c => (
                          <SelectItem key={c} value={c}>{c.replace('Course Committee - ', '')}</SelectItem>
                        ))
                      ) : (
                        programs.find(p => p.id === newAssignment.programId)?.branches.map(b => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Role</Label>
                  <Select value={newAssignment.role} onValueChange={(v:any) => setNewAssignment({...newAssignment, role: v})}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bos_member">Member</SelectItem>
                      <SelectItem value="bos_convenor">Convenor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-1">
                  <Button type="button" size="icon" className="h-9 w-9 shadow-sm" onClick={handleAddAssignment} disabled={!newAssignment.branch}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 min-h-[30px] pt-2">
                {form.managedBranches.map((mb, idx) => (
                  <Badge key={idx} className="bg-white text-foreground border-primary/20 gap-2 h-7 px-2">
                    <span className="font-bold">{mb.programId === 'COMMITTEE' ? 'COMM' : (programs.find(p => p.id === mb.programId)?.code || '??')}</span>
                    {mb.branch.replace('Course Committee - ', '')} 
                    <span className="text-accent font-black uppercase text-[8px]">({(mb.role||'').split('_')[1]})</span>
                    <X className="w-3.5 h-3.5 cursor-pointer text-red-400 hover:text-red-600" onClick={() => handleRemoveAssignment(idx)} />
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="bg-muted/10 p-6 -m-6 border-t mt-4">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isProcessing}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isProcessing} className="shadow-lg px-8">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
              Save Authorization
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
