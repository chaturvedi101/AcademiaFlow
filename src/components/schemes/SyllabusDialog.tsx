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
  Sparkles, FlaskConical, ShieldCheck, Layers, Globe, Video, GraduationCap, Clock, Link as LinkIcon, AlertTriangle, Unlink, CopyPlus, Save, Lock, ArrowRight, Search, CheckCircle2, RefreshCcw, Info
} from "lucide-react";
import { Syllabus, UserProfile, CreditCategory, SubjectType, Scheme, Program, PROGRAM_OUTCOMES, CorrelationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useCollection, useMemoFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";

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
  batchYear,
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
    followedFromId: '', parentSchemeId: '', electiveGroupId: '', timetableSlot: ''
  });

  const [isPoolMode, setIsPoolMode] = useState(false);
  const [poolTitles, setPoolTitles] = useState<string[]>(["Option 1", "Option 2"]);

  const [selectedParentSchemeId, setSelectedParentSchemeId] = useState("");
  const [availableParentSyllabi, setAvailableParentSyllabi] = useState<Syllabus[]>([]);
  const [isFetchingParentSyllabi, setIsFetchingParentSyllabi] = useState(false);
  
  const [selectedParentGroupId, setSelectedParentGroupId] = useState("");
  const [selectedParentOptionId, setSelectedParentOptionId] = useState("");

  const isAdmin = userProfile?.role === 'admin';

  // Universal Retrieval: Get all schemes to allow cross-branch mirroring
  const allSchemesQuery = useMemoFirebase(() => query(collection(db, 'schemes')), [db]);
  const { data: allSchemes } = useCollection<Scheme>(allSchemesQuery);

  const availableParentSchemes = useMemo(() => {
    return allSchemes.filter(s => s.id !== scheme?.id).sort((a, b) => {
       if (a.programId === 'INSTITUTIONAL' && b.programId !== 'INSTITUTIONAL') return -1;
       if (a.programId !== 'INSTITUTIONAL' && b.programId === 'INSTITUTIONAL') return 1;
       return (a.branch || '').localeCompare(b.branch || '');
    });
  }, [allSchemes, scheme?.id]);

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ 
        subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
        credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', 
        poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [], websiteLinks: [],
        followedFromId: '', parentSchemeId: '', electiveGroupId: '', timetableSlot: '',
        ...syllabus
      });
      setSelectedParentSchemeId("");
      setSelectedParentGroupId("");
      setSelectedParentOptionId("");
      setIsPoolMode(false);
      
      const expandMap: Record<string, boolean> = {};
      syllabus.units?.forEach(u => { expandMap[u.id] = true; });
      setExpandedUnits(expandMap);
    }
  }, [open, syllabus]);

  useEffect(() => {
    if (selectedParentSchemeId) {
      setIsFetchingParentSyllabi(true);
      getDocs(collection(db, 'schemes', selectedParentSchemeId, 'syllabi')).then(snap => {
        setAvailableParentSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
        setIsFetchingParentSyllabi(false);
      }).catch(() => setIsFetchingParentSyllabi(false));
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

  const isLinked = !!formData.followedFromId;
  const isFormDisabled = isLinked || !canEdit;
  const isPoolableCategory = ['DSE', 'OFE', 'VAC', 'AEC', 'MDC', 'SEC'].includes(formData.creditCategory || '');

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

    toast({ title: "Inheritance Mapping Locked", description: "Save to synchronize with heritage chain." });
  };

  const handleSeverLink = () => {
    setFormData(prev => ({ ...prev, followedFromId: '', parentSchemeId: '', parentCode: '' }));
    toast({ title: "Inheritance Link Severed" });
  };

  const handleFinalSave = async () => {
    setIsSaving(true);
    try {
      if (isPoolMode && isPoolableCategory && !formData.id) {
        if (!formData.electiveGroupId) {
          toast({ title: "Validation Error", description: "Elective Group ID required for pools.", variant: "destructive" });
          setIsSaving(false);
          return;
        }
        await Promise.all(poolTitles.map(async (title) => {
          if (!title.trim()) return;
          // Create new document for each option
          return onSave({ ...formData, title: title.trim(), id: undefined });
        }));
      } else {
        await onSave(formData);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const unitLabel = formData.type === 'Lab/Sessional' ? 'Experiment' : 'Unit';

  const handleRemoveUnit = (id: string) => {
    if (!isAdmin) {
      toast({ 
        variant: "destructive", 
        title: "Access Restricted", 
        description: "Only Administrators can remove pedagogical units to maintain curriculum integrity." 
      });
      return;
    }
    const newUnits = formData.units?.filter(u => u.id !== id);
    setFormData({ ...formData, units: newUnits });
    toast({ title: "Unit Removed", description: "Pedagogical content updated." });
  };

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
              {isLinked && canEdit && (
                <Button variant="outline" className="text-red-600 border-red-200" onClick={handleSeverLink}>
                  <Unlink className="w-4 h-4 mr-2" /> Sever Mirror
                </Button>
              )}
              <Button onClick={handleAiGenerate} disabled={isAiGenerating || isSaving || isLinked || !canEdit || isPoolMode} variant="outline" className="gap-2">
                {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                AI Architect
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>Universal heritage inheritance enabled across all technical schemes.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full min-h-0 bg-muted/5">
          <div className="p-6 space-y-8">
            {isLinked && (
              <Alert className="bg-emerald-50 border-emerald-200 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <AlertTitle className="font-bold text-emerald-800">Mirror Heritage Active (Read-Only)</AlertTitle>
                <AlertDescription className="text-emerald-700 text-xs">Mirroring course: <b>{formData.parentCode}</b>.</AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-5 mb-8">
                <TabsTrigger value="basic">Identity</TabsTrigger>
                <TabsTrigger value="syllabus">Pedagogy</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="mapping">Outcomes</TabsTrigger>
                <TabsTrigger value="link" disabled={isLinked || !canEdit}>Heritage Link</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Category</Label>
                      <Select disabled={isLinked || !canEdit || !!formData.id} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {isPoolableCategory && !formData.id && (
                      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/10">
                        <div className="space-y-0.5">
                          <Label className="font-bold flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            Multi-Option Pool Mode
                          </Label>
                          <p className="text-[10px] text-muted-foreground">Create multiple course entries for this slot simultaneously.</p>
                        </div>
                        <Switch checked={isPoolMode} onCheckedChange={setIsPoolMode} />
                      </div>
                    )}
                  </div>
                  
                  {!isPoolMode ? (
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                      <Input disabled={isFormDisabled} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pool Option Titles</Label>
                       <div className="p-4 bg-white rounded-xl border space-y-3 shadow-inner">
                         {poolTitles.map((t, i) => (
                           <div key={i} className="flex gap-2">
                             <Input value={t} onChange={e => { const nt=[...poolTitles]; nt[i]=e.target.value; setPoolTitles(nt); }} placeholder={`Option ${i+1}`} />
                             <Button variant="ghost" size="icon" className="text-red-400 h-10 w-10 hover:bg-red-50" onClick={() => setPoolTitles(poolTitles.filter((_, idx) => idx !== i))}><Trash2 className="w-4 h-4" /></Button>
                           </div>
                         ))}
                         <Button variant="ghost" size="sm" className="w-full border-dashed" onClick={() => setPoolTitles([...poolTitles, ""])}><Plus className="w-3.5 h-3.5 mr-2" /> Add Course Option</Button>
                       </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Subject Code</Label>
                    {isAdmin ? (
                      <div className="space-y-1.5">
                        <Input 
                          value={formData.subjectCode || ''} 
                          onChange={e => setFormData({...formData, subjectCode: e.target.value.toUpperCase()})}
                          className="font-mono font-bold text-primary h-10"
                          placeholder="MANUAL-CODE"
                        />
                        <p className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Manual override may break automatic sequencing.
                        </p>
                      </div>
                    ) : (
                      <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md border font-mono font-bold text-primary">
                        {formData.subjectCode || 'AUTO-GEN'}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Type</Label>
                    <Select disabled={isFormDisabled} value={formData.type || 'Theory'} onValueChange={(v: SubjectType) => handleLTPChange({ type: v } as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Theory">Theory</SelectItem><SelectItem value="Lab/Sessional">Practical</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold">Semester</Label>
                    <Input disabled={isFormDisabled} type="number" value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Elective Group ID</Label>
                    <Input 
                      disabled={isLinked || !canEdit} 
                      value={formData.electiveGroupId || ''} 
                      onChange={e => setFormData({...formData, electiveGroupId: e.target.value})} 
                      placeholder="e.g. Elective-I"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4 p-4 bg-white border rounded-xl shadow-inner">
                  <div className="space-y-1"><Label className="text-[10px] font-bold">L</Label><Input type="number" disabled={isFormDisabled || formData.type === 'Lab/Sessional'} value={formData.lectureCredits || 0} onChange={e => handleLTPChange({ lectureCredits: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold">T</Label><Input type="number" disabled={isFormDisabled || formData.type === 'Lab/Sessional'} value={formData.tutorialCredits || 0} onChange={e => handleLTPChange({ tutorialCredits: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold">P</Label><Input type="number" disabled={isFormDisabled || formData.type === 'Theory'} value={formData.practicalCredits || 0} onChange={e => handleLTPChange({ practicalCredits: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label className="text-[10px] font-bold">Cr</Label><div className="h-10 flex items-center justify-center bg-primary/5 rounded font-bold border border-primary/20">{formData.credits}</div></div>
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold">Timetable Slot</Label>
                    <Select disabled={isFormDisabled} value={formData.timetableSlot} onValueChange={(v) => setFormData({...formData, timetableSlot: v})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Slot..." /></SelectTrigger>
                      <SelectContent>{(formData.type === 'Lab/Sessional' ? ['A','B','C','D','E','F'] : ['1','2','3','4','5','6']).map(s => <SelectItem key={s} value={s}>Slot {s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted overflow-hidden">
                     <CardHeader className="p-4 bg-muted/20 flex flex-row items-center justify-between cursor-pointer" onClick={() => setExpandedUnits(p => ({...p, [u.id]: !p[u.id]}))}>
                        <div className="flex items-center gap-3"><Badge>{unitLabel} {i+1}</Badge><span className="font-bold">{u.title || 'Untitled'}</span></div>
                        <div className="flex items-center gap-2">
                           {isAdmin && (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" 
                               onClick={(e) => {
                                 e.stopPropagation();
                                 handleRemoveUnit(u.id);
                               }}
                             >
                               <Trash2 className="w-4 h-4" />
                             </Button>
                           )}
                           {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
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
                      <Label className="font-bold text-primary capitalize">{field.replace('Books', ' Books')}</Label>
                      {(formData as any)[field]?.map((v: string, idx: number) => (
                        <div key={idx} className="flex gap-2">
                          <Input disabled={isFormDisabled} value={v} onChange={e => { const a=[...(formData as any)[field]]; a[idx]=e.target.value; setFormData({...formData, [field]: a}) }} />
                          {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => { const a=(formData as any)[field].filter((_:any, i:number)=>i!==idx); setFormData({...formData, [field]:a}) }}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                        </div>
                      ))}
                      {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, [field]: [...((formData as any)[field]||[]), '']})}><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>}
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
                                <SelectTrigger className="h-8 border-none bg-transparent text-center font-bold text-xs"><SelectValue /></SelectTrigger>
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
                    <div className="flex items-center gap-2"><LinkIcon className="w-5 h-5 text-primary" /><span className="font-bold">Cross-Scheme Heritage Link</span></div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold">1. Select Target Scheme</Label>
                        <Select value={selectedParentSchemeId} onValueChange={setSelectedParentSchemeId}>
                          <SelectTrigger className="bg-white h-11"><SelectValue placeholder="Choose Scheme..." /></SelectTrigger>
                          <SelectContent>
                            <ScrollArea className="h-[250px]">
                              {availableParentSchemes.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.branch || 'Institutional Pool'} ({s.batchYear})
                                </SelectItem>
                              ))}
                            </ScrollArea>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] uppercase font-bold">2. Select Course Group</Label>
                        <div className="flex gap-2">
                           <Button variant={selectedParentGroupId ? "outline" : "secondary"} className="flex-1 h-11" onClick={() => setSelectedParentGroupId("")} disabled={!selectedParentSchemeId}>Individual Course</Button>
                           <Button variant={selectedParentGroupId ? "secondary" : "outline"} className="flex-1 h-11" onClick={() => setSelectedParentGroupId(parentElectiveGroups[0] || "SELECT")} disabled={!selectedParentSchemeId || parentElectiveGroups.length === 0}>Elective Pool</Button>
                        </div>
                      </div>
                    </div>

                    {selectedParentSchemeId && !isFetchingParentSyllabi && (
                      <div className="space-y-6 animate-in slide-in-from-top-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] uppercase font-bold">3. Select Subject to Mirror</Label>
                           <Select value={selectedParentOptionId} onValueChange={setSelectedParentOptionId}>
                             <SelectTrigger className="bg-white h-11"><SelectValue placeholder="Select Standard Subject..." /></SelectTrigger>
                             <SelectContent>
                               <ScrollArea className="h-[200px]">
                                 {(selectedParentGroupId ? parentGroupOptions : nonElectiveParentSyllabi).map(o => (
                                   <SelectItem key={o.id} value={o.id}>{o.subjectCode} - {o.title}</SelectItem>
                                 ))}
                               </ScrollArea>
                             </SelectContent>
                           </Select>
                        </div>
                        <Button className="w-full h-12 gap-2 shadow-lg" disabled={!selectedParentOptionId} onClick={handleEstablishLink}><LinkIcon className="w-4 h-4" /> Authorize Mirror Link</Button>
                      </div>
                    )}

                    {isFetchingParentSyllabi && (
                      <div className="py-10 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" /><p className="text-xs font-bold">Syncing Records...</p>
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
           {canEdit && (
             <Button onClick={handleFinalSave} className="h-11 px-8 shadow-md" disabled={isSaving}>
               {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
               {isSaving ? "Synchronizing..." : isPoolMode ? "Generate Options" : "Save Subject Pattern"}
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
