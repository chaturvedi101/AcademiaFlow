'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Scheme, Program, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, Eye, Loader2, FileCheck, Clock, Layers, RotateCcw, ShieldCheck, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function ApprovalsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  // Fetch all schemes to provide a complete status overview
  const schemesQuery = useMemoFirebase(() => {
    return query(collection(db, 'schemes'), orderBy('updatedAt', 'desc'));
  }, [db]);

  const { data: schemes, loading } = useCollection<Scheme>(schemesQuery);
  const { data: programs } = useCollection<Program>(useMemoFirebase(() => collection(db, 'programs'), [db]));

  const [revertDialogOpen, setRevertDialogOpen] = useState(false);
  const [selectedSchemeForRevert, setSelectedSchemeForRevert] = useState<Scheme | null>(null);
  const [revertComments, setRevertComments] = useState('');

  const filteredSchemes = useMemo(() => {
    if (!profile || !programs.length) return [];
    
    // Global authorities see everything
    if (profile.role === 'dean_academic' || profile.role === 'admin' || profile.role === 'monitor') return schemes;
    
    const isBTECHTier = profile.faculty?.includes('BTECH');
    const isBBATier = profile.faculty?.includes('BBA');

    return schemes.filter(s => {
      // Pool Logic
      if (s.programId === 'INSTITUTIONAL') {
        if (isBTECHTier && (s.branch?.includes('BTECH') || s.isVerticalPool)) return true;
        if (isBBATier && (s.branch?.includes('BBA') || s.isVerticalPool)) return true;
        return false;
      }
      // Program Logic
      const prog = programs.find(p => p.id === s.programId);
      if (!prog) return false;
      
      if (profile.role === 'dean_faculty' && prog.faculty === profile.faculty) return true;
      if (isBTECHTier && prog.faculty.includes('BTECH')) return true;
      if (isBBATier && prog.faculty.includes('Management')) return true;

      return false;
    });
  }, [schemes, profile, programs]);

  const handleApprove = (scheme: Scheme) => {
    const nextStatus = profile?.role === 'dean_faculty' ? 'Pending Academics' : 'Approved';
    const schemeRef = doc(db, 'schemes', scheme.id);
    
    updateDoc(schemeRef, { 
      status: nextStatus, 
      updatedAt: serverTimestamp(),
      reversionComments: null 
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

  const handleRevert = async () => {
    if (!selectedSchemeForRevert || !revertComments) return;
    
    const schemeRef = doc(db, 'schemes', selectedSchemeForRevert.id);
    await updateDoc(schemeRef, {
      status: 'Draft',
      reversionComments: revertComments,
      updatedAt: serverTimestamp()
    });

    toast({ title: "Scheme Reverted", description: "Returned to BoS with observations." });
    setRevertDialogOpen(false);
    setSelectedSchemeForRevert(null);
    setRevertComments('');
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Institutional Status Board</h1>
        <p className="text-muted-foreground">
          {profile?.role === 'dean_faculty' 
            ? `Monitoring curriculum lifecycle for ${profile.faculty}.` 
            : 'University-wide scheme implementation and accreditation status.'}
        </p>
      </div>

      <Card>
        <CardHeader className="bg-muted/10">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Curriculum Registry Matrix
          </CardTitle>
          <CardDescription>
            Tabular overview of branch schemes and pool statuses. Actions are available when status matches your approval level.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Branch / Program</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="text-right pr-6">Decisions & Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchemes.map((scheme) => {
                const program = programs.find(p => p.id === scheme.programId);
                
                // Determine if the current user can take a decision
                const isDeanActionable = profile?.role === 'dean_faculty' && scheme.status === 'Pending Dean';
                const isAcadActionable = (profile?.role === 'dean_academic' || profile?.role === 'admin') && scheme.status === 'Pending Academics';
                const isActionable = isDeanActionable || isAcadActionable;

                const statusColor: Record<string, string> = {
                  'Draft': 'bg-slate-100 text-slate-700',
                  'Pending Dean': 'bg-amber-100 text-amber-700',
                  'Pending Academics': 'bg-blue-100 text-blue-700',
                  'Approved': 'bg-emerald-100 text-emerald-700'
                };

                return (
                  <TableRow key={scheme.id} className={cn("hover:bg-muted/5 transition-colors", isActionable && "bg-primary/5")}>
                    <TableCell className="pl-6">
                      <div className="space-y-0.5">
                        <p className="font-bold text-sm">{scheme.branch || program?.name}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black tracking-tighter">
                          {program?.faculty || 'Institutional Pool'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">{scheme.batchYear}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={cn("text-[9px] font-bold uppercase border-none", statusColor[scheme.status])}>
                        {scheme.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <span className="text-[10px] font-medium text-muted-foreground">{scheme.submissionScope || 'Complete'}</span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" asChild className="h-8 px-2">
                          <Link href={`/dashboard/schemes/${scheme.id}`} className="gap-2">
                            <Eye className="w-3.5 h-3.5" /> Review Pool
                          </Link>
                        </Button>
                        
                        {isActionable && (
                          <div className="flex gap-2 items-center border-l pl-3 ml-1">
                            <Button variant="outline" size="sm" className="h-8 text-red-600 border-red-200 hover:bg-red-50 text-[10px] uppercase font-bold" onClick={() => {
                              setSelectedSchemeForRevert(scheme);
                              setRevertDialogOpen(true);
                            }}>
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
                            </Button>
                            <Button size="sm" className="h-8 gap-2 bg-emerald-600 hover:bg-emerald-700 text-[10px] uppercase font-bold" onClick={() => handleApprove(scheme)}>
                              <CheckCircle className="w-3.5 h-3.5" /> Approve
                            </Button>
                          </div>
                        )}

                        {!isActionable && scheme.status !== 'Approved' && profile?.role !== 'monitor' && (
                           <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic px-2">
                             <Clock className="w-3 h-3" /> Awaiting Tier Progress
                           </div>
                        )}

                        {scheme.status === 'Approved' && (
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-bold px-2">
                             <ShieldCheck className="w-3 h-3" /> Accredited
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredSchemes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No schemes found within your institutional purview.</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={revertDialogOpen} onOpenChange={revertDialogOpen => {
        setRevertDialogOpen(revertDialogOpen);
        if(!revertDialogOpen) {
           setSelectedSchemeForRevert(null);
           setRevertComments('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-red-600" />
              Revert Scheme to BoS
            </DialogTitle>
            <DialogDescription>
              Identify specific pedagogical or structural corrections required. The Board of Studies will resolve these in Draft mode.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
             <div className="p-3 bg-muted/30 rounded-lg text-[11px] border">
               <span className="font-bold">Target:</span> {selectedSchemeForRevert?.branch} ({selectedSchemeForRevert?.batchYear})
             </div>
            <Textarea 
              placeholder="Enter technical observations or required corrections..." 
              value={revertComments} 
              onChange={e => setRevertComments(e.target.value)}
              className="min-h-[120px] text-sm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!revertComments} onClick={handleRevert} className="gap-2">
              Confirm Revert to Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
