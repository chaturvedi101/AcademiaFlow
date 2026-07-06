"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight, Info, Link as LinkIcon, Unlink, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useDoc, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { UserProfile, Scheme, Syllabus } from "@/lib/types";
import Link from "next/link";

export default function EquivalencePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const [parentSchemeId, setParentSchemeId] = useState("");
  const [childSchemeId, setChildSchemeId] = useState("");
  const [parentSyllabusId, setParentSyllabusId] = useState("");
  const [childSyllabusId, setChildSyllabusId] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: allSchemes, loading: schemesLoading } = useCollection<Scheme>(
    useMemoFirebase(() => collection(db, 'schemes'), [db])
  );

  const [childSyllabi, setChildSyllabi] = useState<Syllabus[]>([]);
  const [parentSyllabi, setParentSyllabi] = useState<Syllabus[]>([]);

  // Parent Pools: Both specialized Course Committees and Vertical Common Pools (AEC/VAC/MDC)
  const authoritativePools = useMemo(() => 
    allSchemes.filter(s => s.isCommitteePool || s.isCommonPoolScheme), 
  [allSchemes]);
  
  const branchSchemes = useMemo(() => {
    const base = allSchemes.filter(s => !s.isCommitteePool && !s.isCommonPoolScheme);
    
    // Admins and Dean Academic can see everything
    if (profile?.role === 'admin' || profile?.role === 'dean_academic') {
      return base;
    }

    // BoS Convenors can only see schemes they manage
    const managed = profile?.managedBranches || [];
    return base.filter(s => 
      managed.some(m => m.programId === s.programId && m.branch === s.branch && m.role === 'bos_convenor')
    );
  }, [allSchemes, profile]);

  // Load Syllabi for selected schemes
  useEffect(() => {
    if (childSchemeId) {
      getDocs(collection(db, 'schemes', childSchemeId, 'syllabi')).then(snap => {
        setChildSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
      });
    }
  }, [childSchemeId, db]);

  useEffect(() => {
    if (parentSchemeId) {
      getDocs(collection(db, 'schemes', parentSchemeId, 'syllabi')).then(snap => {
        setParentSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
      });
    }
  }, [parentSchemeId, db]);

  const handleLinkCourses = async () => {
    if (!childSyllabusId || !parentSyllabusId) return;
    setIsProcessing(true);
    
    const childRef = doc(db, 'schemes', childSchemeId, 'syllabi', childSyllabusId);

    try {
      await updateDoc(childRef, {
        followedFromId: parentSyllabusId,
        parentSchemeId: parentSchemeId,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Equivalence Established", description: "Departmental course is now linked to standard parent." });
      setChildSyllabusId("");
      // Refresh local list
      setChildSyllabi(prev => prev.map(s => s.id === childSyllabusId ? { ...s, followedFromId: parentSyllabusId } : s));
    } catch (e: any) {
      toast({ variant: "destructive", title: "Linking Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUnlink = async (syllabusId: string) => {
    setIsProcessing(true);
    const childRef = doc(db, 'schemes', childSchemeId, 'syllabi', syllabusId);
    try {
      await updateDoc(childRef, {
        followedFromId: null,
        parentSchemeId: null,
        updatedAt: serverTimestamp()
      });
      setChildSyllabi(prev => prev.map(s => s.id === syllabusId ? { ...s, followedFromId: undefined } : s));
      toast({ title: "Equivalence Removed" });
    } finally {
      setIsProcessing(false);
    }
  };

  if (schemesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Institutional Equivalence Manager</h1>
        <p className="text-muted-foreground">Map branch subjects to authoritative Course Committee or Common BOS standards.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit shadow-lg border-primary/10">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" /> Standard Assignment
            </CardTitle>
            <CardDescription>Link a branch course to inherit from a specialized pool.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">1. Target Departmental Scheme (Child)</Label>
                <Select value={childSchemeId} onValueChange={setChildSchemeId}>
                  <SelectTrigger><SelectValue placeholder="Choose Branch..." /></SelectTrigger>
                  <SelectContent>
                    {branchSchemes.map(s => <SelectItem key={s.id} value={s.id}>{s.branch} ({s.batchYear})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">2. Target Subject Slot (Child)</Label>
                <Select value={childSyllabusId} onValueChange={setChildSyllabusId} disabled={!childSchemeId}>
                  <SelectTrigger><SelectValue placeholder="Choose Slot..." /></SelectTrigger>
                  <SelectContent>
                    {childSyllabi.map(s => <SelectItem key={s.id} value={s.id}>{s.subjectCode} - {s.title || 'Untitled Slot'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-center py-2"><ArrowRight className="w-6 h-6 text-muted-foreground rotate-90 lg:rotate-0" /></div>

            <div className="space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary">3. Source Authority Pool (Parent)</Label>
                <Select value={parentSchemeId} onValueChange={setParentSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Authority..." /></SelectTrigger>
                  <SelectContent>
                    {authoritativePools.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.branch} {s.isCommonPoolScheme ? '(Vertical)' : '(Committee)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary">4. Standard Authoritative Course (Parent)</Label>
                <Select value={parentSyllabusId} onValueChange={setParentSyllabusId} disabled={!parentSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Course..." /></SelectTrigger>
                  <SelectContent>
                    {parentSyllabi.map(s => <SelectItem key={s.id} value={s.id}>{s.subjectCode} - {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full h-12 gap-2 shadow-lg" onClick={handleLinkCourses} disabled={!childSyllabusId || !parentSyllabusId || isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Register Parent-Child Link
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border-none bg-white">
          <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg">Equivalence Registry</CardTitle>
            <CardDescription>Courses following institutional standards in {branchSchemes.find(s => s.id === childSchemeId)?.branch || 'Selected Scheme'}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Branch Subject (Child)</TableHead>
                  <TableHead></TableHead>
                  <TableHead>Authoritative Parent</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {childSyllabi.filter(s => s.followedFromId).map(s => {
                  const parentInfo = parentSyllabi.find(p => p.id === s.followedFromId);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="pl-6">
                        <p className="font-bold text-sm">{s.subjectCode}</p>
                        <p className="text-xs text-muted-foreground">{s.title}</p>
                      </TableCell>
                      <TableCell><ArrowRight className="w-4 h-4 text-primary opacity-30" /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                          {parentInfo?.subjectCode || 'Linked Parent'}
                        </Badge>
                        <p className="text-[10px] mt-1 text-muted-foreground italic">
                          {parentInfo?.title || 'Standardized Content'}
                        </p>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleUnlink(s.id)}>
                          <Unlink className="w-4 h-4 mr-2" /> Sever Link
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {childSyllabi.filter(s => s.followedFromId).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground italic">
                      No parent-child equivalences registered for this scheme.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}