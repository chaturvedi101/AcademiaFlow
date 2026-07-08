"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";
import { Layers, ArrowRight, Link as LinkIcon, Unlink, Loader2, CheckCircle2, ShieldCheck, History, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useDoc, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, updateDoc, serverTimestamp, getDocs, collectionGroup } from "firebase/firestore";
import { UserProfile, Scheme, Syllabus } from "@/lib/types";

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
  const [globalEquivalences, setGlobalEquivalences] = useState<Syllabus[]>([]);

  // Unlink Confirmation State
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [pendingUnlink, setPendingUnlink] = useState<{ schemeId: string; syllabusId: string } | null>(null);

  const { data: allSchemes, loading: schemesLoading } = useCollection<Scheme>(
    useMemoFirebase(() => collection(db, 'schemes'), [db])
  );

  const [childSyllabi, setChildSyllabi] = useState<Syllabus[]>([]);
  const [parentSyllabi, setParentSyllabi] = useState<Syllabus[]>([]);

  // Institutional Registry Resolver: Fetch all mirrors
  useEffect(() => {
    const fetchGlobalRegistry = async () => {
      try {
        const q = query(collectionGroup(db, 'syllabi'));
        const snap = await getDocs(q);
        const linked = snap.docs
          .map(d => ({ ...d.data(), id: d.id } as Syllabus))
          .filter(s => !!s.followedFromId);
        setGlobalEquivalences(linked);
      } catch (e: any) {
        console.error("Registry lookup failed:", e);
      }
    };
    fetchGlobalRegistry();
  }, [db, isProcessing]);

  const authoritativePools = useMemo(() => 
    allSchemes.filter(s => s.isCommitteePool || s.isVerticalPool), 
  [allSchemes]);
  
  const branchSchemes = useMemo(() => {
    const base = allSchemes.filter(s => !s.isCommitteePool && !s.isVerticalPool);
    if (profile?.role === 'admin' || profile?.role === 'dean_academic') return base;
    
    const managed = profile?.managedBranches || [];
    return base.filter(s => 
      managed.some(m => m.programId === s.programId && m.branch === s.branch && m.role === 'bos_convenor')
    );
  }, [allSchemes, profile]);

  const jurisdictionalEquivalences = useMemo(() => {
    if (!profile) return [];
    if (profile.role === 'admin' || profile.role === 'dean_academic') return globalEquivalences;
    
    const mySchemeIds = new Set(branchSchemes.map(s => s.id));
    return globalEquivalences.filter(s => mySchemeIds.has(s.schemeId));
  }, [globalEquivalences, branchSchemes, profile]);

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
    const parent = parentSyllabi.find(p => p.id === parentSyllabusId);

    try {
      await updateDoc(childRef, {
        followedFromId: parentSyllabusId,
        parentSchemeId: parentSchemeId,
        parentCode: parent?.subjectCode || '',
        updatedAt: serverTimestamp()
      });
      toast({ title: "Equivalence Established", description: "Departmental slot is now mirroring institutional standard." });
      setChildSyllabusId("");
      setIsProcessing(prev => !prev);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Linking Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmUnlink = async () => {
    if (!pendingUnlink) return;
    setIsProcessing(true);
    const childRef = doc(db, 'schemes', pendingUnlink.schemeId, 'syllabi', pendingUnlink.syllabusId);
    try {
      await updateDoc(childRef, {
        followedFromId: null,
        parentSchemeId: null,
        parentCode: null,
        updatedAt: serverTimestamp()
      });
      toast({ title: "Equivalence Severed", description: "The course has been disconnected from the institutional standard." });
      setIsProcessing(prev => !prev);
      setUnlinkConfirmOpen(false);
      setPendingUnlink(null);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Unlinking Failed", description: e.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const triggerUnlinkDialog = (schemeId: string, syllabusId: string) => {
    setPendingUnlink({ schemeId, syllabusId });
    setUnlinkConfirmOpen(true);
  };

  if (schemesLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-8 h-8 text-primary" /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">Institutional Equivalence Manager</h1>
        <p className="text-muted-foreground">Authorize departmental courses to mirror BTECH Committee or Vertical Pool standards.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit shadow-lg border-primary/10">
          <CardHeader className="bg-primary/5 border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="w-5 h-5 text-primary" /> Authorization Engine
            </CardTitle>
            <CardDescription>Assign authoritative content to a departmental slot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">1. Target Branch Scheme (Child)</Label>
                <Select value={childSchemeId} onValueChange={setChildSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Branch..." /></SelectTrigger>
                  <SelectContent>
                    {branchSchemes.map(s => <SelectItem key={s.id} value={s.id}>{s.branch} ({s.batchYear})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase">2. Departmental Subject Slot (Child)</Label>
                <Select value={childSyllabusId} onValueChange={setChildSyllabusId} disabled={!childSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Subject Slot..." /></SelectTrigger>
                  <SelectContent>
                    {childSyllabi.map(s => <SelectItem key={s.id} value={s.id}>{s.subjectCode} - {s.title || 'Untitled Slot'}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-center py-2"><ArrowRight className="w-6 h-6 text-muted-foreground rotate-90 lg:rotate-0" /></div>

            <div className="space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-primary">3. Source Authority Pool (Parent)</Label>
                <Select value={parentSchemeId} onValueChange={setParentSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Pool..." /></SelectTrigger>
                  <SelectContent>
                    {authoritativePools.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.branch} {s.isVerticalPool ? '(Vertical)' : '(Committee)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-primary">4. Standard Authoritative Course (Parent)</Label>
                <Select value={parentSyllabusId} onValueChange={setParentSyllabusId} disabled={!parentSchemeId}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Standard Course..." /></SelectTrigger>
                  <SelectContent>
                    {parentSyllabi.map(s => <SelectItem key={s.id} value={s.id}>{s.subjectCode} - {s.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full h-12 gap-2 shadow-lg" onClick={handleLinkCourses} disabled={!childSyllabusId || !parentSyllabusId || isProcessing}>
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Authorize Inheritance Link
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border-none bg-white overflow-hidden">
          <CardHeader className="bg-muted/10 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Equivalence Registry</CardTitle>
              <CardDescription>
                {profile?.role === 'admin' || profile?.role === 'dean_academic' 
                  ? 'Comprehensive list of all authorized standardizations across BTECH branches.' 
                  : 'Equivalences authorized within your departmental jurisdiction.'}
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary">
              {jurisdictionalEquivalences.length} active links
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Branch Slot (Virtual Child)</TableHead>
                  <TableHead className="text-center"></TableHead>
                  <TableHead>Authoritative Parent (Standard)</TableHead>
                  <TableHead className="text-right pr-6">Management</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jurisdictionalEquivalences.map(s => {
                  const schemeInfo = allSchemes.find(sch => sch.id === s.schemeId);
                  return (
                    <TableRow key={s.id} className="group hover:bg-muted/10">
                      <TableCell className="pl-6">
                        <div className="space-y-1">
                          <p className="font-bold text-sm text-primary">{s.subjectCode}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-black">{schemeInfo?.branch || 'Unknown Branch'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><ArrowRight className="w-4 h-4 text-muted-foreground opacity-30" /></TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit bg-emerald-50 text-emerald-700 border-emerald-200 gap-1.5 py-1">
                            <ShieldCheck className="w-3 h-3" />
                            {s.parentCode || 'Linked Parent'}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{s.title || 'Institutional Standard'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => triggerUnlinkDialog(s.schemeId, s.id)}>
                          <Unlink className="w-4 h-4 mr-2" /> Sever link
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {jurisdictionalEquivalences.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                      <History className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p className="italic">No institutional equivalences found in your scope.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Sever Institutional Link?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action will disconnect the departmental course from its authoritative standard. 
              The course will revert to its original state and will no longer automatically mirror updates 
              from the Board of Studies (BOS) pool.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingUnlink(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmUnlink}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Sever Mirror Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}