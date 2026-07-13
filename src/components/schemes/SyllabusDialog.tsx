"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  BookOpen, Loader2, Plus, ChevronDown, ChevronUp, Trash2, 
  Sparkles, FlaskConical, ShieldCheck, Layers, Globe, Video, GraduationCap, Clock, Link as LinkIcon, AlertTriangle, Unlink, CopyPlus, Save, Lock, ArrowRight, Search, CheckCircle2
} from "lucide-react";
import { Syllabus, UserProfile, CreditCategory, SubjectType, Scheme, Program, PROGRAM_OUTCOMES, CorrelationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";

const ALL_CATEGORIES: CreditCategory[] = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];
const LOCK_EXPIRATION_MS = 10 * 60 * 1000; // 10 minutes institutional expiration
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes heartbeat

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  allSyllabi?: Syllabus[];
  onSave: (data: Partial<Syllabus>) => Promise<void>;
  canEdit?: boolean;
  batchYear?: string;
  userProfile?: UserProfile;
  program?: Program;
  scheme?: Scheme;
}

export function SyllabusDialog({ 
  open, 
  onOpenChange, 
  syllabus,
  allSyllabi,
  onSave,
  canEdit = true,
  userProfile,
  program,
  scheme
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [], websiteLinks: [],
    followedFromId: '', electiveGroupId: '', timetableSlot: ''
  });

  // Concurrency Lock State
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const [lockStatus, setLockStatus] = useState<{ isLocked: boolean; ownerName?: string } | null>(null);

  // Pool Mode State
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [poolTitles, setPoolTitles] = useState<string[]>(["Option Subject 1", "Option Subject 2", "Option Subject 3"]);

  // Inheritance Logic State
  const [wantsToLink, setWantsToLink] = useState(false);
  const [selectedParentSchemeId, setSelectedParentSchemeId] = useState("");
  const [availableParentSyllabi, setAvailableParentSyllabi] = useState<Syllabus[]>([]);
  const [isFetchingParentSyllabi, setIsFetchingParentSyllabi] = useState(false);
  
  const [selectedParentGroupId, setSelectedParentGroupId] = useState("");
  const [selectedParentOptionId, setSelectedParentOptionId] = useState("");

  const { data: allPoolSchemes } = useCollection<Scheme>(useMemoFirebase(() => query(collection(db, 'schemes'), where('programId', '==', 'INSTITUTIONAL')), [db]));

  // Real-time lock check with expiration logic
  useEffect(() => {
    if (open && syllabus?.lockedBy) {
      const lock = syllabus.lockedBy;
      const now = Date.now();
      const lockTime = lock.timestamp?.toMillis() || now; 
      const isExpired = (now - lockTime) > LOCK_EXPIRATION_MS;

      if (lock.sessionId !== sessionId && !isExpired) {
        setLockStatus({ isLocked: true, ownerName: lock.displayName });
      } else {
        setLockStatus({ isLocked: false });
      }
    } else if (open) {
      setLockStatus({ isLocked: false });
    }
  }, [open, syllabus?.lockedBy, sessionId]);

  // Acquire, Release, and Heartbeat for Locks
  useEffect(() => {
    // CRITICAL: Ensure user and userProfile are fully loaded to avoid 'undefined' values in Firestore
    if (!open || !canEdit || !syllabus?.id || !scheme?.id || !userProfile || !user?.uid) return;

    const syllabusRef = doc(db, 'schemes', scheme.id, 'syllabi', syllabus.id!);

    const acquireLock = async () => {
      const snap = await getDoc(syllabusRef);
      if (snap.exists()) {
        const currentData = snap.data() as Syllabus;
        const now = Date.now();
        const lockTime = currentData.lockedBy?.timestamp?.toMillis() || 0;
        const isExpired = (now - lockTime) > LOCK_EXPIRATION_MS;

        // Claim lock if none exists, or it's ours, or it's expired
        if (!currentData.lockedBy || currentData.lockedBy.sessionId === sessionId || isExpired) {
          await updateDoc(syllabusRef, {
            lockedBy: {
              uid: user.uid,
              displayName: userProfile.displayName || "Academic User",
              sessionId: sessionId,
              timestamp: serverTimestamp()
            }
          });
        }
      }
    };

    const releaseLock = async () => {
      const snap = await getDoc(syllabusRef);
      if (snap.exists()) {
        const currentData = snap.data() as Syllabus;
        if (currentData.lockedBy?.sessionId === sessionId) {
          await updateDoc(syllabusRef, { lockedBy: null });
        }
      }
    };

    // Heartbeat: Keep the lock fresh
    const interval = setInterval(async () => {
      if (!user?.uid) return;
      const snap = await getDoc(syllabusRef);
      if (snap.exists()) {
        const currentData = snap.data() as Syllabus;
        if (currentData.lockedBy?.sessionId === sessionId) {
          await updateDoc(syllabusRef, { 'lockedBy.timestamp': serverTimestamp() });
        }
      }
    }, HEARTBEAT_INTERVAL_MS);

    acquireLock();
    
    const handleUnload = () => { releaseLock(); };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      releaseLock();
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [open, canEdit, syllabus?.id, scheme?.id, userProfile, user?.uid, sessionId, db]);

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ 
        subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
        credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', 
        poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [], websiteLinks: [],
        followedFromId: '', electiveGroupId: '', timetableSlot: '',
        ...syllabus
      });
      setWantsToLink(false);
      setSelectedParentSchemeId("");
      setSelectedParentGroupId("");
      setSelectedParentOptionId("");
      setIsPoolMode(false);
      if (syllabus.followedFromId || (syllabus as any).isInherited) {
        const expandMap: Record<string, boolean> = {};
        syllabus.units?.forEach(u => { expandMap[u.id] = true; });
        setExpandedUnits(expandMap);
      }
    }
  }, [open, syllabus]);

  useEffect(() => {
    if (selectedParentSchemeId) {
      setIsFetchingParentSyllabi(true);
      getDocs(collection(db, 'schemes', selectedParentSchemeId, 'syllabi')).then(snap => {
        setAvailableParentSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
        setIsFetchingParentSyllabi(false);
      });
    } else {
      setAvailableParentSyllabi([]);
    }
  }, [selectedParentSchemeId, db]);

  const parentElectiveGroups = useMemo(() => {
    const groups = new Set<string>();
    availableParentSyllabi.forEach(s => {
      if (s.electiveGroupId && s.electiveGroupId !== 'CORE') groups.add(s.electiveGroupId);
    });
    return Array.from(groups);
  }, [availableParentSyllabi]);

  const parentGroupOptions = useMemo(() => {
    if (!selectedParentGroupId) return [];
    return availableParentSyllabi.filter(s => s.electiveGroupId === selectedParentGroupId);
  }, [availableParentSyllabi, selectedParentGroupId]);

  const nonElectiveParentSyllabi = useMemo(() => {
    return availableParentSyllabi.filter(s => !s.electiveGroupId || s.electiveGroupId === 'CORE');
  }, [availableParentSyllabi]);

  const timetableClash = useMemo(() => {
    if (!formData.timetableSlot || !formData.semester || !allSyllabi) return null;
    return allSyllabi.find(s => 
      s.semester === formData.semester && 
      s.timetableSlot === formData.timetableSlot && 
      s.id !== formData.id
    );
  }, [formData.timetableSlot, formData.semester, formData.id, allSyllabi]);

  const isLinked = !!formData.followedFromId;
  const isLockedByOthers = !!lockStatus?.isLocked;
  const isFormDisabled = isLinked || !canEdit || isLockedByOthers;
  const isElectiveCategory = formData.creditCategory === 'DSE' || formData.creditCategory === 'OFE';

  const handleAiGenerate = async () => {
    if (!formData.title) return;
    setIsAiGenerating(true);
    try {
      const result = await generateSyllabusContent({
        title: formData.title,
        category: formData.creditCategory,
        credits: formData.credits,
        type: formData.type
      });
      setFormData(prev => ({
        ...prev,
        units: result.units.map(u => ({ id: Math.random().toString(36).substr(2,9), ...u })),
        textBooks: result.suggestedTextBooks,
        referenceBooks: result.suggestedReferences
      }));
      toast({ title: "Pedagogical Content Engineered" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "AI Engineering Error", description: e.message });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleLTPChange = (updates: Partial<{ lectureCredits: number, tutorialCredits: number, practicalCredits: number }>) => {
    const newData = { ...formData, ...updates };
    const l = newData.lectureCredits || 0;
    const t = newData.tutorialCredits || 0;
    const p = newData.practicalCredits || 0;
    let total = l + t;
    if (p === 1) total += 0.5;
    else if (p === 2) total += 1;
    else if (p === 3) total += 2;
    else if (p === 4) total += 2;
    else if (p > 4) total += p / 2;
    setFormData({ ...newData, credits: Number(total.toFixed(2)) });
  };

  const handleEstablishLink = async () => {
    const parent = availableParentSyllabi.find(s => s.id === selectedParentOptionId);
    if (!parent) return;

    const targetLinkId = parent.followedFromId || parent.id;
    const targetParentSchemeId = parent.parentSchemeId || selectedParentSchemeId;
    const targetParentCode = parent.parentCode || parent.subjectCode;

    setFormData(prev => ({
      ...prev,
      followedFromId: targetLinkId,
      parentSchemeId: targetParentSchemeId,
      parentCode: targetParentCode,
      title: parent.title,
      type: parent.type,
      credits: parent.credits,
      lectureCredits: parent.lectureCredits,
      tutorialCredits: parent.tutorialCredits,
      practicalCredits: parent.practicalCredits,
      units: parent.units || [],
      textBooks: parent.textBooks || [],
      referenceBooks: parent.referenceBooks || [],
      nptelLinks: parent.nptelLinks || [],
      youtubeLinks: parent.youtubeLinks || [],
      websiteLinks: parent.websiteLinks || []
    }));

    toast({ title: "Mirror Connection Established", description: `Mirroring Standard: ${targetParentCode}` });
    setWantsToLink(false);
  };

  const handleFinalSave = async () => {
    setIsSaving(true);
    try {
      if (isPoolMode && isElectiveCategory && !formData.id) {
        if (!formData.electiveGroupId) {
          toast({ title: "Validation Error", description: "Group ID is required for pools.", variant: "destructive" });
          setIsSaving(false);
          return;
        }
        await Promise.all(poolTitles.map(async (title) => {
          if (!title.trim()) return;
          return onSave({ ...formData, title: title.trim(), timetableSlot: formData.timetableSlot || '' });
        }));
      } else {
        await onSave(formData);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Synchronization Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const unitLabel = formData.type === 'Lab/Sessional' ? 'Experiment' : 'Unit';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {formData.type === 'Lab/Sessional' ? <FlaskConical className="w-6 h-6 text-accent" /> : <BookOpen className="w-6 h-6 text-primary" />} 
              Course Architect
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAiGenerate} disabled={isAiGenerating || isSaving || !formData.title || isLinked || !canEdit || isPoolMode || isLockedByOthers} variant="outline" className="gap-2">
                {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                AI Architect
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Construct methodology. Mirror institutional standards safely. Child changes never affect parents.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full min-h-0 bg-muted/5">
          <div className="p-6 space-y-8">
            {isLockedByOthers && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 shadow-sm animate-pulse">
                <Lock className="h-5 w-5" />
                <AlertTitle className="font-black uppercase text-[10px] tracking-widest mb-1">Concurrency Lock Active</AlertTitle>
                <AlertDescription className="text-sm font-medium">
                  Currently being edited by <span className="font-black underline">{lockStatus?.ownerName}</span> in another window.
                </AlertDescription>
              </Alert>
            )}

            {isLinked && !isLockedByOthers && (
              <Alert className="bg-emerald-50 border-emerald-200 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <AlertTitle className="font-bold text-emerald-800">Mirror Active (Read-Only)</AlertTitle>
                <AlertDescription className="text-emerald-700 text-xs">
                  Mirroring Institutional Standard: <b>{formData.parentCode}</b>. Sever link in Scheme Detail to edit.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-5 mb-8">
                <TabsTrigger value="basic">Identity</TabsTrigger>
                <TabsTrigger value="syllabus">Pedagogy</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="mapping">Outcomes</TabsTrigger>
                <TabsTrigger value="link" disabled={isLinked || !canEdit || isLockedByOthers}>Institutional Link</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Category</Label>
                    <Select disabled={isLinked || !canEdit || !!formData.id || isLockedByOthers} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  
                  {!isPoolMode ? (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                      <Input disabled={isFormDisabled} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pool Multi-Entry</Label>
                       <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                         {poolTitles.map((t, i) => (
                           <div key={i} className="flex gap-2">
                             <Input disabled={isLockedByOthers} value={t} onChange={e => { const nt=[...poolTitles]; nt[i]=e.target.value; setPoolTitles(nt); }} placeholder={`Option ${i+1}...`} className="bg-white" />
                             <Button disabled={isLockedByOthers} variant="ghost" size="icon" className="h-9 w-9 text-red-400" onClick={() => setPoolTitles(poolTitles.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                           </div>
                         ))}
                         <Button disabled={isLockedByOthers} variant="ghost" size="sm" onClick={() => setPoolTitles([...poolTitles, ""])} className="text-[10px] uppercase font-bold"><Plus className="w-3 h-3 mr-1" /> Add Option</Button>
                       </div>
                    </div>
                  )}
                </div>

                {isElectiveCategory && !formData.id && !isLockedByOthers && (
                  <Card className="border-accent/10 bg-accent/5">
                    <CardContent className="p-4 flex items-center justify-between">
                      <Label className="font-bold flex items-center gap-2 text-accent"><CopyPlus className="w-4 h-4" /> Elective Pool Multi-Generation</Label>
                      <Switch checked={isPoolMode} onCheckedChange={setIsPoolMode} />
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Code</Label><div className="h-10 flex items-center px-3 bg-muted/50 rounded-md border font-mono font-bold text-primary">{formData.subjectCode || 'AUTO-GEN'}</div></div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Type</Label>
                    <Select disabled={isFormDisabled} value={formData.type || 'Theory'} onValueChange={(v: SubjectType) => handleLTPChange({ type: v } as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Theory">Theory</SelectItem><SelectItem value="Lab/Sessional">Practical</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label className="text-[10px] uppercase font-bold">Semester</Label><Input disabled={isFormDisabled} type="number" value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} /></div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Timetable Slot</Label>
                    <Select disabled={isFormDisabled} value={formData.timetableSlot} onValueChange={(v) => setFormData({...formData, timetableSlot: v})}>
                      <SelectTrigger className={cn(timetableClash && "border-red-500 text-red-800")}><SelectValue placeholder="Slot..." /></SelectTrigger>
                      <SelectContent>{(formData.type === 'Lab/Sessional' ? ['A','B','C','D','E','F'] : ['1','2','3','4','5','6']).map(s => <SelectItem key={s} value={s}>Slot {s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 p-4 bg-white border rounded-xl shadow-inner">
                  <div className="space-y-1"><Label className="text-[10px] font-bold">L</Label><Input type="number" disabled={isFormDisabled || formData.type === 'Lab/Sessional'} value={formData.lectureCredits || 0} onChange={e => handleLTPChange({ lectureCredits: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold">T</Label><Input type="number" disabled={isFormDisabled || formData.type === 'Lab/Sessional'} value={formData.tutorialCredits || 0} onChange={e => handleLTPChange({ tutorialCredits: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold">P</Label><Input type="number" disabled={isFormDisabled || formData.type === 'Theory'} value={formData.practicalCredits || 0} onChange={e => handleLTPChange({ practicalCredits: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold">Cr</Label><div className="h-10 flex items-center justify-center bg-primary/5 rounded font-bold border border-primary/20">{formData.credits}</div></div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted overflow-hidden">
                     <CardHeader className="p-4 bg-muted/20 flex flex-row items-center justify-between cursor-pointer" onClick={() => setExpandedUnits(p => ({...p, [u.id]: !p[u.id]}))}>
                        <div className="flex items-center gap-3"><Badge>{unitLabel} {i+1}</Badge><span className="font-bold">{u.title || 'Untitled'}</span></div>
                        {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                     </CardHeader>
                     <CardContent className={cn("p-4 space-y-4", !expandedUnits[u.id] && "hidden")}>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2"><Label>Title</Label><Input disabled={isFormDisabled} value={u.title} onChange={e => { const u2=[...formData.units!]; u2[i].title=e.target.value; setFormData({...formData, units:u2}) }} /></div>
                           <div className="space-y-2"><Label>Hours</Label><Input type="number" disabled={isFormDisabled} value={u.hours} onChange={e => { const u2=[...formData.units!]; u2[i].hours=Number(e.target.value); setFormData({...formData, units:u2}) }} /></div>
                        </div>
                        <div className="space-y-2"><Label>Topics</Label><Textarea disabled={isFormDisabled} value={u.content} onChange={e => { const u2=[...formData.units!]; u2[i].content=e.target.value; setFormData({...formData, units:u2}) }} /></div>
                        <div className="space-y-2"><Label>Course Outcome</Label><Input disabled={isFormDisabled} value={u.courseOutcome} onChange={e => { const u2=[...formData.units!]; u2[i].courseOutcome=e.target.value; setFormData({...formData, units:u2}) }} /></div>
                     </CardContent>
                   </Card>
                 ))}
                 {!isFormDisabled && <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(36).substr(2,9), title:'', content:'', hours:0, courseOutcome:''}]}))}><Plus className="w-4 h-4 mr-2" /> Add {unitLabel}</Button>}
              </TabsContent>

              <TabsContent value="resources" className="space-y-6">
                <div className="grid grid-cols-2 gap-8">
                  {['textBooks', 'referenceBooks', 'nptelLinks', 'youtubeLinks'].map((field) => (
                    <div key={field} className="space-y-4">
                      <Label className="font-bold text-primary capitalize">{field.replace('Books', ' Books').replace('Links', ' Links')}</Label>
                      {(formData as any)[field]?.map((v: string, idx: number) => (
                        <div key={idx} className="flex gap-2">
                          <Input disabled={isFormDisabled} value={v} onChange={e => { const a=[...(formData as any)[field]]; a[idx]=e.target.value; setFormData({...formData, [field]: a}) }} />
                          {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => { const a=(formData as any)[field].filter((_:any, i:number)=>i!==idx); setFormData({...formData, [field]:a}) }}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                        </div>
                      ))}
                      {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, [field]: [...((formData as any)[field]||[]), '']})} className="text-primary"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>}
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6">
                <ScrollArea className="w-full border rounded-xl bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[200px] text-[10px] font-black">CO</TableHead>
                        {PROGRAM_OUTCOMES.map(po => <TableHead key={po.code} className="text-center text-[10px] font-black">{po.code}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.units?.map((unit, uIdx) => (
                        <TableRow key={unit.id}>
                          <TableCell className="text-[10px] font-bold">CO{uIdx + 1}</TableCell>
                          {PROGRAM_OUTCOMES.map(po => (
                            <TableCell key={po.code} className="p-1">
                              <Select disabled={isFormDisabled} value={formData.poMappings?.[unit.id]?.[po.code] || '-'} onValueChange={(v: CorrelationLevel) => {
                                const cur = { ...(formData.poMappings || {}) };
                                const unitM = { ...(cur[unit.id] || {}) };
                                unitM[po.code] = v;
                                cur[unit.id] = unitM;
                                setFormData({...formData, poMappings: cur});
                              }}>
                                <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted/50 focus:ring-0 text-center font-bold text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="-">-</SelectItem><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="3">3</SelectItem></SelectContent>
                              </Select>
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              </TabsContent>

              <TabsContent value="link" className="space-y-6">
                <Card className="border-primary/10 shadow-lg overflow-hidden">
                  <CardHeader className="bg-primary/5 border-b py-4">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-5 h-5 text-primary" />
                      <span className="font-bold">Establish Institutional Inheritance</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">1. Select Authority Pool</Label>
                        <Select value={selectedParentSchemeId} onValueChange={setSelectedParentSchemeId}>
                          <SelectTrigger className="bg-white h-11"><SelectValue placeholder="Choose Pool..." /></SelectTrigger>
                          <SelectContent>
                            {allPoolSchemes.map(s => <SelectItem key={s.id} value={s.id}>{s.branch} ({s.batchYear})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">2. Select Standard Type</Label>
                        <div className="flex gap-2">
                           <Button 
                             variant={selectedParentGroupId ? "outline" : "secondary"} 
                             className="flex-1 h-11 gap-2"
                             onClick={() => setSelectedParentGroupId("")}
                             disabled={!selectedParentSchemeId || isFetchingParentSyllabi}
                           >
                             <CheckCircle2 className="w-4 h-4" /> Compulsory
                           </Button>
                           <Button 
                             variant={selectedParentGroupId ? "secondary" : "outline"} 
                             className="flex-1 h-11 gap-2"
                             onClick={() => setSelectedParentGroupId(parentElectiveGroups[0] || "SELECT")}
                             disabled={!selectedParentSchemeId || isFetchingParentSyllabi || parentElectiveGroups.length === 0}
                           >
                             <Layers className="w-4 h-4" /> Elective Pool
                           </Button>
                        </div>
                      </div>
                    </div>

                    {selectedParentSchemeId && !isFetchingParentSyllabi && (
                      <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                        {selectedParentGroupId ? (
                          <div className="space-y-4 p-4 bg-accent/5 rounded-xl border border-accent/10">
                            <div className="flex items-center gap-2 text-accent font-bold text-sm">
                               <Layers className="w-4 h-4" /> Resolve Elective Option
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-1">
                                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Target Pool Group</Label>
                                  <Select value={selectedParentGroupId} onValueChange={setSelectedParentGroupId}>
                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {parentElectiveGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                               </div>
                               <div className="space-y-1">
                                  <Label className="text-[10px] uppercase font-bold text-accent">3. Which option should be mirrored?</Label>
                                  <Select value={selectedParentOptionId} onValueChange={setSelectedParentOptionId}>
                                    <SelectTrigger className="bg-white border-accent/30"><SelectValue placeholder="Select Mirror Option..." /></SelectTrigger>
                                    <SelectContent>
                                      {parentGroupOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.subjectCode} - {o.title}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                               </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">3. Select Compulsory Subject</Label>
                             <Select value={selectedParentOptionId} onValueChange={setSelectedParentOptionId}>
                               <SelectTrigger className="bg-white h-11"><SelectValue placeholder="Select Standard Subject..." /></SelectTrigger>
                               <SelectContent>
                                 {nonElectiveParentSyllabi.map(o => <SelectItem key={o.id} value={o.id}>{o.subjectCode} - {o.title}</SelectItem>)}
                               </SelectContent>
                             </Select>
                          </div>
                        )}

                        <Button 
                          className="w-full h-12 gap-2 shadow-lg" 
                          disabled={!selectedParentOptionId}
                          onClick={handleEstablishLink}
                        >
                          <LinkIcon className="w-4 h-4" /> Authorize Institutional Inheritance
                        </Button>
                      </div>
                    )}

                    {isFetchingParentSyllabi && (
                      <div className="py-20 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="font-bold animate-pulse">Syncing University Standard Repository...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0 shadow-lg">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">Cancel</Button>
           {canEdit && !isLockedByOthers && (
             <Button onClick={handleFinalSave} className="h-11 px-8 shadow-md" disabled={isSaving}>
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
               {isSaving ? "Synchronizing..." : (isPoolMode ? "Generate Pool" : "Save Subject Pattern")}
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}