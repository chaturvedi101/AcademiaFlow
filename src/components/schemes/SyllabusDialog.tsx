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
  Sparkles, FlaskConical, ShieldCheck, Layers, Globe, Video, GraduationCap, Clock, Link as LinkIcon, AlertTriangle, Unlink, CopyPlus, Save, Lock
} from "lucide-react";
import { Syllabus, UserProfile, CreditCategory, SubjectType, Scheme, Program, PROGRAM_OUTCOMES, CorrelationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";

const ALL_CATEGORIES: CreditCategory[] = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];

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

  // Linking State
  const [wantsToLink, setWantsToLink] = useState(false);
  const [selectedLinkSchemeId, setSelectedLinkSchemeId] = useState("");
  const [availableParentSyllabi, setAvailableParentSyllabi] = useState<Syllabus[]>([]);
  const [isFetchingParentSyllabi, setIsFetchingParentSyllabi] = useState(false);
  const [isEstablishingLink, setIsEstablishingLink] = useState(false);

  // Real-time lock check via syllabus prop (which comes from the parent collection listener)
  useEffect(() => {
    if (open && syllabus?.lockedBy) {
      if (syllabus.lockedBy.sessionId !== sessionId) {
        setLockStatus({ isLocked: true, ownerName: syllabus.lockedBy.displayName });
      } else {
        setLockStatus({ isLocked: false });
      }
    } else if (open) {
      setLockStatus({ isLocked: false });
    }
  }, [open, syllabus?.lockedBy, sessionId]);

  // Acquire and Release Locks
  useEffect(() => {
    if (!open || !canEdit || !syllabus?.id || !scheme?.id || !userProfile) return;

    const acquireLock = async () => {
      const syllabusRef = doc(db, 'schemes', scheme.id, 'syllabi', syllabus.id!);
      const snap = await getDoc(syllabusRef);
      const currentData = snap.data() as Syllabus;

      if (!currentData.lockedBy || currentData.lockedBy.sessionId === sessionId) {
        await updateDoc(syllabusRef, {
          lockedBy: {
            uid: user?.uid,
            displayName: userProfile.displayName,
            sessionId: sessionId,
            timestamp: serverTimestamp()
          }
        });
      }
    };

    const releaseLock = async () => {
      const syllabusRef = doc(db, 'schemes', scheme.id, 'syllabi', syllabus.id!);
      const snap = await getDoc(syllabusRef);
      if (snap.exists()) {
        const currentData = snap.data() as Syllabus;
        if (currentData.lockedBy?.sessionId === sessionId) {
          await updateDoc(syllabusRef, { lockedBy: null });
        }
      }
    };

    acquireLock();

    // Release lock on unmount or dialog close
    const handleUnload = () => { releaseLock(); };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
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
      setWantsToLink(!!syllabus.followedFromId);
      setIsPoolMode(false);
      setPoolTitles(["Option Subject 1", "Option Subject 2", "Option Subject 3"]);
      if (syllabus.followedFromId || (syllabus as any).isInherited) {
        const expandMap: Record<string, boolean> = {};
        syllabus.units?.forEach(u => { expandMap[u.id] = true; });
        setExpandedUnits(expandMap);
      }
    }
  }, [open, syllabus]);

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
  const isCoreCategory = formData.creditCategory === 'DSC' || formData.creditCategory === 'PRJ' || formData.creditCategory === 'SEC';
  const isElectiveCategory = formData.creditCategory === 'DSE' || formData.creditCategory === 'OFE';

  useEffect(() => {
    if (!open || !canEdit || formData.followedFromId || isLockedByOthers) return;
    
    const currentUnits = formData.units || [];
    if (currentUnits.length === 0) {
      const initialCount = formData.type === 'Lab/Sessional' ? 8 : 5;
      const initialUnits = Array.from({ length: initialCount }, (_, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: '',
        content: '',
        hours: formData.type === 'Lab/Sessional' ? 2 : 8,
        courseOutcome: ''
      }));
      setFormData(prev => ({ ...prev, units: initialUnits }));
    }
  }, [formData.type, open, canEdit, formData.followedFromId, isLockedByOthers]);

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

  const calculateCredits = (l: number, t: number, p: number) => {
    let total = l + t;
    if (p === 1) total += 0.5;
    else if (p === 2) total += 1;
    else if (p === 3) total += 2;
    else if (p === 4) total += 2;
    else if (p > 4) total += p / 2;
    return Number(total.toFixed(2));
  };

  const handleLTPChange = (updates: Partial<{ lectureCredits: number, tutorialCredits: number, practicalCredits: number }>) => {
    const newData = { ...formData, ...updates };
    const credits = calculateCredits(
      newData.lectureCredits || 0,
      newData.tutorialCredits || 0,
      newData.practicalCredits || 0
    );
    setFormData({ ...newData, credits });
  };

  const handlePOMapping = (unitId: string, poCode: string, level: CorrelationLevel) => {
    if (isFormDisabled) return;
    const currentMappings = { ...(formData.poMappings || {}) };
    const unitMappings = { ...(currentMappings[unitId] || {}) };
    unitMappings[poCode] = level;
    currentMappings[unitId] = unitMappings;
    setFormData({ ...formData, poMappings: currentMappings });
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
          const optionData = {
            ...formData,
            title: title.trim(),
            timetableSlot: formData.timetableSlot || '' 
          };
          return onSave(optionData);
        }));
      } else {
        await onSave(formData);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Synchronization Failed", 
        description: error.message || "Could not commit changes to Firestore."
      });
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
            Construct methodology. Mirror institutional standards safely. Modification in child schemes never affects master parents.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full min-h-0 bg-muted/5">
          <div className="p-6 space-y-8">
            {isLockedByOthers && (
              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800 shadow-sm animate-pulse">
                <Lock className="h-5 w-5" />
                <AlertTitle className="font-black uppercase text-[10px] tracking-widest mb-1">Concurrency Lock Active</AlertTitle>
                <AlertDescription className="text-sm font-medium">
                  This course is currently being edited by <span className="font-black underline">{lockStatus?.ownerName}</span> in another window. 
                  Simultaneous editing is prohibited to ensure institutional data integrity.
                </AlertDescription>
              </Alert>
            )}

            {isLinked && !isLockedByOthers && (
              <Alert className="bg-emerald-50 border-emerald-200 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <AlertTitle className="font-bold text-emerald-800">
                  Institutional Mirror Active (Read-Only)
                </AlertTitle>
                <AlertDescription className="text-emerald-700 text-xs">
                  This slot currently inherits all content from Master: <b>{formData.parentCode}</b>. 
                  Modifications at this level are disabled. Use "Sever Link" in the Scheme Detail page to branch off.
                </AlertDescription>
              </Alert>
            )}

            {timetableClash && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 shadow-sm">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-bold">Slot Conflict Detected</AlertTitle>
                <AlertDescription className="mt-1">
                  Conflict with: <b>{timetableClash.title} ({timetableClash.subjectCode})</b> in Sem {formData.semester}. 
                  Each slot must be unique within a semester.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Identity</TabsTrigger>
                <TabsTrigger value="syllabus">Pedagogical Content</TabsTrigger>
                <TabsTrigger value="resources">Learning Resources</TabsTrigger>
                <TabsTrigger value="mapping">Outcomes Mapping</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credit Category</Label>
                    <Select disabled={isLinked || !canEdit || !!syllabus?.id || isLockedByOthers} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
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
                       <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pool Group Mode (Multi-Entry)</Label>
                       <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
                         {poolTitles.map((t, i) => (
                           <div key={i} className="flex gap-2">
                             <Badge variant="outline" className="h-9 w-24 shrink-0 bg-white">Option {i+1}</Badge>
                             <Input 
                               disabled={isLockedByOthers}
                               value={t} 
                               onChange={e => {
                                 const nt = [...poolTitles];
                                 nt[i] = e.target.value;
                                 setPoolTitles(nt);
                               }}
                               placeholder={`Option Subject ${i+1}...`}
                               className="bg-white"
                             />
                             <Button disabled={isLockedByOthers} variant="ghost" size="icon" className="h-9 w-9 text-red-400" onClick={() => setPoolTitles(poolTitles.filter((_, idx) => idx !== i))}>
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           </div>
                         ))}
                         <Button disabled={isLockedByOthers} variant="ghost" size="sm" onClick={() => setPoolTitles([...poolTitles, ""])} className="text-[10px] uppercase font-bold">
                           <Plus className="w-3 h-3 mr-1" /> Add Option
                         </Button>
                       </div>
                    </div>
                  )}
                </div>

                {isElectiveCategory && !syllabus?.id && !isLockedByOthers && (
                  <Card className="border-accent/10 bg-accent/5">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="font-bold flex items-center gap-2 text-accent">
                          <CopyPlus className="w-4 h-4" /> Elective Pool Multi-Generation
                        </Label>
                        <p className="text-[10px] text-muted-foreground">Instantly create a standard 3-option elective group.</p>
                      </div>
                      <Switch checked={isPoolMode} onCheckedChange={setIsPoolMode} />
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Local Course Code</Label>
                    <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md border font-mono font-bold text-primary">{formData.subjectCode || 'AUTO-GEN'}</div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pedagogy</Label>
                    <Select disabled={isFormDisabled} value={formData.type || 'Theory'} onValueChange={(v: SubjectType) => {
                      const l = v === 'Lab/Sessional' ? 0 : formData.lectureCredits;
                      const t = v === 'Lab/Sessional' ? 0 : formData.tutorialCredits;
                      const p = v === 'Theory' ? 0 : formData.practicalCredits;
                      setFormData({...formData, type: v, lectureCredits: l, tutorialCredits: t, practicalCredits: p, credits: calculateCredits(l||0, t||0, p||0) });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory (L-T)</SelectItem>
                        <SelectItem value="Lab/Sessional">Practical (P)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Semester</Label>
                    <Input disabled={isFormDisabled} type="number" value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Timetable Slot</Label>
                    <Select disabled={isFormDisabled} value={formData.timetableSlot} onValueChange={(v) => setFormData({...formData, timetableSlot: v})}>
                      <SelectTrigger className={cn(timetableClash && "border-red-500 text-red-800")}>
                        <SelectValue placeholder="Slot..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(formData.type === 'Lab/Sessional' ? ['A','B','C','D','E','F'] : ['1','2','3','4','5','6']).map(s => <SelectItem key={s} value={s}>Slot {s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Elective Group ID (Pool Mapping)</Label>
                      <Input 
                        disabled={isFormDisabled || isCoreCategory} 
                        placeholder="e.g. Elective-I" 
                        value={isCoreCategory ? "CORE" : (formData.electiveGroupId || '')} 
                        onChange={e => setFormData({...formData, electiveGroupId: e.target.value})}
                        className={cn(isCoreCategory && "bg-muted/50", isPoolMode && "border-primary/50 bg-white")}
                      />
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
                        <div className="flex items-center gap-2">
                           {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                           {!isFormDisabled && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setFormData({...formData, units: formData.units?.filter((_, idx) => idx !== i)}); }}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                        </div>
                     </CardHeader>
                     <CardContent className={cn("p-4 space-y-4", !expandedUnits[u.id] && "hidden")}>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2"><Label>Title</Label><Input disabled={isFormDisabled} value={u.title} onChange={e => { const u2=[...formData.units!]; u2[i].title=e.target.value; setFormData({...formData, units:u2}) }} /></div>
                           <div className="space-y-2"><Label>Hours</Label><Input type="number" disabled={isFormDisabled} value={u.hours} onChange={e => { const u2=[...formData.units!]; u2[i].hours=Number(e.target.value); setFormData({...formData, units:u2}) }} /></div>
                        </div>
                        <div className="space-y-2"><Label>Content</Label><Textarea disabled={isFormDisabled} value={u.content} onChange={e => { const u2=[...formData.units!]; u2[i].content=e.target.value; setFormData({...formData, units:u2}) }} /></div>
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
                        <TableHead className="w-[200px] text-[10px] font-black">COURSE OUTCOME (CO)</TableHead>
                        {PROGRAM_OUTCOMES.map(po => <TableHead key={po.code} className="text-center text-[10px] font-black">{po.code}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.units?.map((unit, uIdx) => (
                        <TableRow key={unit.id}>
                          <TableCell className="text-[10px] font-bold">CO{uIdx + 1}: {unit.courseOutcome?.substring(0, 40)}...</TableCell>
                          {PROGRAM_OUTCOMES.map(po => (
                            <TableCell key={po.code} className="p-1">
                              <Select disabled={isFormDisabled} value={formData.poMappings?.[unit.id]?.[po.code] || '-'} onValueChange={(v: CorrelationLevel) => handlePOMapping(unit.id, po.code, v)}>
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
            </Tabs>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0 shadow-lg">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">Cancel</Button>
           {canEdit && !isLockedByOthers && (
             <Button onClick={handleFinalSave} className="h-11 px-8 shadow-md" disabled={isEstablishingLink || isSaving}>
               {isEstablishingLink || isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
               {isSaving ? "Synchronizing..." : (isPoolMode ? "Generate Pool" : "Save Subject Pattern")}
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}