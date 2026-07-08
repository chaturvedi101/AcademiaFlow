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
  Sparkles, FlaskConical, ShieldCheck, Layers, Globe, Video, GraduationCap, Clock, Link as LinkIcon, AlertTriangle
} from "lucide-react";
import { Syllabus, UserProfile, CreditCategory, SubjectType, Scheme, Program, PROGRAM_OUTCOMES, CorrelationLevel } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";

const ALL_CATEGORIES: CreditCategory[] = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  allSyllabi?: Syllabus[];
  onSave: (data: Partial<Syllabus>) => void;
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

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [], websiteLinks: [],
    followedFromId: '', electiveGroupId: '', timetableSlot: ''
  });

  // Linking State
  const [wantsToLink, setWantsToLink] = useState(false);
  const [selectedLinkSchemeId, setSelectedLinkSchemeId] = useState("");
  const [availableParentSyllabi, setAvailableParentSyllabi] = useState<Syllabus[]>([]);
  const [isFetchingParentSyllabi, setIsFetchingParentSyllabi] = useState(false);
  const [isEstablishingLink, setIsEstablishingLink] = useState(false);

  const { data: allSchemes } = useCollection<Scheme>(useMemoFirebase(() => collection(db, 'schemes'), [db]));

  const isSuperuser = userProfile?.role === 'admin' || userProfile?.role === 'dean_academic';

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
      if (syllabus.followedFromId || (syllabus as any).isInherited) {
        const expandMap: Record<string, boolean> = {};
        syllabus.units?.forEach(u => { expandMap[u.id] = true; });
        setExpandedUnits(expandMap);
      }
    }
  }, [open, syllabus]);

  useEffect(() => {
    if (selectedLinkSchemeId) {
      setIsFetchingParentSyllabi(true);
      getDocs(collection(db, 'schemes', selectedLinkSchemeId, 'syllabi'))
        .then(snap => {
          setAvailableParentSyllabi(snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus)));
        })
        .finally(() => setIsFetchingParentSyllabi(false));
    } else {
      setAvailableParentSyllabi([]);
    }
  }, [selectedLinkSchemeId, db]);

  const timetableClash = useMemo(() => {
    if (!formData.timetableSlot || !formData.semester || !allSyllabi) return null;
    return allSyllabi.find(s => 
      s.semester === formData.semester && 
      s.timetableSlot === formData.timetableSlot && 
      s.id !== formData.id
    );
  }, [formData.timetableSlot, formData.semester, formData.id, allSyllabi]);

  const unitCount = formData.units?.length || 0;
  const isLab = formData.type === 'Lab/Sessional';
  const unitLabel = isLab ? 'Experiment' : 'Unit';

  useEffect(() => {
    if (!open || !canEdit || formData.followedFromId) return;
    
    const currentUnits = formData.units || [];
    if (currentUnits.length === 0) {
      const initialCount = isLab ? 8 : 5;
      const initialUnits = Array.from({ length: initialCount }, (_, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: '',
        content: '',
        hours: isLab ? 2 : 8,
        courseOutcome: ''
      }));
      setFormData(prev => ({ ...prev, units: initialUnits }));
    }
  }, [formData.type, open, canEdit, formData.followedFromId]);

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

  const isLinked = !!formData.followedFromId;
  const isFormDisabled = (isLinked && !isSuperuser) || !canEdit;
  const isCategoryLocked = isFormDisabled || !!syllabus?.id;

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

  const handleEstablishLink = async (parentSyllabusId: string) => {
    if (!parentSyllabusId) return;
    setIsEstablishingLink(true);
    try {
      const parentRef = doc(db, 'schemes', selectedLinkSchemeId, 'syllabi', parentSyllabusId);
      const parentSnap = await getDoc(parentRef);
      if (parentSnap.exists()) {
        const parentData = parentSnap.data() as Syllabus;
        setFormData(prev => ({
          ...prev,
          followedFromId: parentSyllabusId,
          parentSchemeId: selectedLinkSchemeId,
          parentCode: parentData.subjectCode,
          title: parentData.title,
          type: parentData.type,
          credits: parentData.credits,
          lectureCredits: parentData.lectureCredits,
          tutorialCredits: parentData.tutorialCredits,
          practicalCredits: parentData.practicalCredits,
          units: parentData.units,
          textBooks: parentData.textBooks,
          referenceBooks: parentData.referenceBooks,
          nptelLinks: parentData.nptelLinks,
          youtubeLinks: parentData.youtubeLinks,
          websiteLinks: parentData.websiteLinks,
          poMappings: parentData.poMappings,
          timetableSlot: parentData.timetableSlot || ''
        }));
        toast({ title: "Institutional Standard established", description: "All pedagogical details, including timetable slot and outcomes, have been synchronized." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Linking Failed", description: e.message });
    } finally {
      setIsEstablishingLink(false);
    }
  };

  const isElectiveCategory = ['DSE', 'OFE', 'VAC', 'AEC', 'MDC'].includes(formData.creditCategory || '');

  const timetableOptions = isLab 
    ? ['A', 'B', 'C', 'D', 'E', 'F'] 
    : ['1', '2', '3', '4', '5', '6'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isLab ? <FlaskConical className="w-6 h-6 text-accent" /> : <BookOpen className="w-6 h-6 text-primary" />} 
              Course Architect
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAiGenerate} disabled={isAiGenerating || !formData.title || isLinked} variant="outline" className="gap-2">
                {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                AI Architect
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Construct pedagogical methodology and content. Establish mirror links to institutional standards.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full min-h-0 bg-muted/5">
          <div className="p-6 space-y-8">
            {isLinked && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 text-emerald-800 text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <div className="flex flex-col">
                    <p className="font-bold">Institutional Mirror Active</p>
                    <p className="text-xs">Mirroring standard syllabus: <span className="font-black">{(formData as any).parentCode || 'Standard Pool'}</span></p>
                  </div>
                </div>
                {(isSuperuser || canEdit) && (
                  <Button variant="ghost" size="sm" className="text-emerald-700 hover:bg-emerald-100" onClick={() => setFormData({...formData, followedFromId: '', parentSchemeId: '', parentCode: ''})}>
                    Sever Link & Restore Slot
                  </Button>
                )}
              </div>
            )}

            {timetableClash && (
              <Alert variant="destructive" className="bg-red-50 border-red-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="font-bold">Timetable Slot Conflict</AlertTitle>
                <AlertDescription className="mt-1 space-y-2">
                  <p>
                    {isLinked 
                      ? `Slot ${formData.timetableSlot} is inherited from the institutional parent.` 
                      : `Slot ${formData.timetableSlot} is currently manually assigned.`}
                  </p>
                  <p className="font-medium text-red-800">
                    Conflict detected with: <span className="font-black">{timetableClash.title} ({timetableClash.subjectCode})</span> in Semester {formData.semester}.
                  </p>
                  <p className="text-[11px] italic">
                    University policy mandates unique slots per semester. Please reassign the slot for the clashing departmental course.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">{isLinked ? "Mirror Identity" : "Identity"}</TabsTrigger>
                <TabsTrigger value="syllabus" className="gap-2">
                  Content 
                  <Badge variant="outline" className="text-[10px] px-1.5 h-4 min-w-4 flex items-center justify-center">
                    {unitCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="resources">Learning Resources</TabsTrigger>
                <TabsTrigger value="mapping">Outcomes</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                {!isLinked && canEdit && (
                  <Card className="border-dashed border-primary/20 bg-primary/5">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold flex items-center gap-2 text-primary">
                          <LinkIcon className="w-4 h-4" /> Establish Institutional Link?
                        </Label>
                        <Switch checked={wantsToLink} onCheckedChange={setWantsToLink} />
                      </div>
                      
                      {wantsToLink && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t mt-2">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold">Source Branch / Pool</Label>
                            <Select value={selectedLinkSchemeId} onValueChange={setSelectedLinkSchemeId}>
                              <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Scheme..." /></SelectTrigger>
                              <SelectContent>
                                {allSchemes.map(s => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.branch || 'Institutional Pool'} ({s.batchYear})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold">Standard Subject</Label>
                            <Select 
                              disabled={!selectedLinkSchemeId || isFetchingParentSyllabi} 
                              onValueChange={handleEstablishLink}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder={isFetchingParentSyllabi ? "Fetching subjects..." : "Choose Subject..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableParentSyllabi.map(s => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.subjectCode} - {s.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {isLinked && (
                  <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-2 shadow-inner">
                    <Label className="text-[10px] uppercase font-bold text-primary flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5" /> Parent Authority
                    </Label>
                    <p className="text-sm font-medium">
                      This course mirrors institutional standard <span className="font-black text-primary">{(formData as any).parentCode}</span>.
                    </p>
                    <p className="text-[10px] text-muted-foreground italic">
                      Units, Hours, Learning Resources, Outcomes, and Timetable Slots are synchronized with the authoritative Board of Studies pool.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credit Category</Label>
                    <Select disabled={isCategoryLocked} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                    <Input disabled={isFormDisabled} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Engineering Physics-I" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Subject Code (LOCKED)</Label>
                    <div className="h-10 flex items-center px-3 bg-muted/50 rounded-md border font-mono font-bold text-primary shadow-inner">
                      {formData.subjectCode || 'AUTO-GEN'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pedagogy</Label>
                    <Select disabled={isFormDisabled} value={formData.type || 'Theory'} onValueChange={(v: any) => {
                      const l = v === 'Lab/Sessional' ? 0 : formData.lectureCredits;
                      const t = v === 'Lab/Sessional' ? 0 : formData.tutorialCredits;
                      const p = v === 'Theory' ? 0 : formData.practicalCredits;
                      const credits = calculateCredits(l || 0, t || 0, p || 0);
                      setFormData({...formData, type: v, lectureCredits: l, tutorialCredits: t, practicalCredits: p, credits });
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
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                      <Clock className="w-3 h-3" /> Timetable Slot
                    </Label>
                    <Select disabled={isFormDisabled} value={formData.timetableSlot} onValueChange={(v) => setFormData({...formData, timetableSlot: v})}>
                      <SelectTrigger className={cn("bg-white", timetableClash && "border-red-500 text-red-800")}><SelectValue placeholder="Select Slot..." /></SelectTrigger>
                      <SelectContent>
                        {timetableOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>Slot {opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border rounded-xl shadow-inner">
                  <div className="space-y-1">
                    <Label className={cn("text-[10px] uppercase font-bold", isLab && "text-muted-foreground opacity-50")}>L (Lecture)</Label>
                    <Input type="number" disabled={isFormDisabled || isLab} value={formData.lectureCredits || 0} onChange={e => handleLTPChange({ lectureCredits: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className={cn("text-[10px] uppercase font-bold", isLab && "text-muted-foreground opacity-50")}>T (Tutorial)</Label>
                    <Input type="number" disabled={isFormDisabled || isLab} value={formData.tutorialCredits || 0} onChange={e => handleLTPChange({ tutorialCredits: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className={cn("text-[10px] uppercase font-bold", !isLab && "text-muted-foreground opacity-50")}>P (Practical Hours)</Label>
                    <Input type="number" disabled={isFormDisabled || !isLab} value={formData.practicalCredits || 0} onChange={e => handleLTPChange({ practicalCredits: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">Credits</Label>
                    <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary border border-primary/20">{formData.credits} Cr</div>
                  </div>
                </div>

                <div className="space-y-2 max-w-sm">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Elective Slot ID</Label>
                  <div className="flex gap-2">
                      <Input 
                      disabled={isFormDisabled || !isElectiveCategory} 
                      value={formData.electiveGroupId || ''} 
                      onChange={e => setFormData({...formData, electiveGroupId: e.target.value})} 
                      placeholder="e.g. Elective-I" 
                      className="font-bold text-primary"
                    />
                    <Badge variant="outline" className="shrink-0"><Layers className="w-3 h-3" /></Badge>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted overflow-hidden shadow-sm">
                     <CardHeader 
                      className="p-4 bg-muted/20 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedUnits(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                     >
                        <div className="flex items-center gap-3">
                          <Badge className="bg-primary/10 text-primary border-none">{unitLabel} {i+1}</Badge>
                          <span className="font-bold">{u.title || `Untitled ${unitLabel}`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {!isFormDisabled && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                const units = [...(formData.units || [])];
                                units.splice(i, 1);
                                setFormData({ ...formData, units });
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                     </CardHeader>
                     <CardContent className={cn("p-4 space-y-4", !expandedUnits[u.id] && "hidden")}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2"><Label>{unitLabel} Title</Label><Input disabled={isFormDisabled} value={u.title || ''} onChange={e => { const units = [...(formData.units || [])]; units[i].title = e.target.value; setFormData({ ...formData, units }); }} /></div>
                           <div className="space-y-2"><Label>Teaching Hours</Label><Input type="number" disabled={isFormDisabled} value={u.hours || 0} onChange={e => { const units = [...(formData.units || [])]; units[i].hours = Number(e.target.value); setFormData({ ...formData, units }); }} /></div>
                        </div>
                        <div className="space-y-2">
                          <Label>{isLab ? 'Procedure / Object' : 'Detailed Topics'}</Label>
                          <Textarea disabled={isFormDisabled} value={u.content || ''} onChange={e => { const units = [...(formData.units || [])]; units[i].content = e.target.value; setFormData({ ...formData, units }); }} className="min-h-[120px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Course Outcome (CO)</Label>
                          <Input disabled={isFormDisabled} value={u.courseOutcome || ''} onChange={e => { const units = [...(formData.units || [])]; units[i].courseOutcome = e.target.value; setFormData({ ...formData, units }); }} placeholder="The student will be able to..." />
                        </div>
                     </CardContent>
                   </Card>
                 ))}
                 {!isFormDisabled && (
                   <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(36).substr(2,9), title:'', content:'', hours:0, courseOutcome:''}]}))}>
                     <Plus className="w-4 h-4 mr-2" /> Add {unitLabel} Slot
                   </Button>
                 )}
              </TabsContent>

              <TabsContent value="resources" className="space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   {/* Learning Resources */}
                   <div className="space-y-4">
                      <Label className="font-bold text-primary flex items-center gap-2">
                        <BookOpen className="w-4 h-4" /> Standard Text Books
                      </Label>
                      <div className="space-y-2">
                        {formData.textBooks?.map((it, i) => (
                          <div key={i} className="flex gap-2">
                            <Input value={it} disabled={isFormDisabled} onChange={e => { const a=[...formData.textBooks!]; a[i]=e.target.value; setFormData({...formData, textBooks:a}) }} placeholder="Author, Title, Edition, Publisher" />
                            {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, textBooks: formData.textBooks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                          </div>
                        ))}
                        {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, textBooks: [...(formData.textBooks||[]), '']})} className="text-primary h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Add Textbook</Button>}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <Label className="font-bold text-primary flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Reference Materials
                      </Label>
                      <div className="space-y-2">
                        {formData.referenceBooks?.map((it, i) => (
                          <div key={i} className="flex gap-2">
                            <Input value={it} disabled={isFormDisabled} onChange={e => { const a=[...formData.referenceBooks!]; a[i]=e.target.value; setFormData({...formData, referenceBooks:a}) }} placeholder="Reference details..." />
                            {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, referenceBooks: formData.referenceBooks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                          </div>
                        ))}
                        {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, referenceBooks: [...(formData.referenceBooks||[]), '']})} className="text-primary h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Add Reference</Button>}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <Label className="font-bold text-primary flex items-center gap-2">
                        <GraduationCap className="w-4 h-4" /> NPTEL / Online Courses
                      </Label>
                      <div className="space-y-2">
                        {formData.nptelLinks?.map((it, i) => (
                          <div key={i} className="flex gap-2">
                            <Input value={it} disabled={isFormDisabled} onChange={e => { const a=[...formData.nptelLinks!]; a[i]=e.target.value; setFormData({...formData, nptelLinks:a}) }} placeholder="URL to NPTEL/SWAYAM Course" />
                            {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, nptelLinks: formData.nptelLinks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                          </div>
                        ))}
                        {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, nptelLinks: [...(formData.nptelLinks||[]), '']})} className="text-primary h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Add MOOC Link</Button>}
                      </div>
                   </div>

                   <div className="space-y-4">
                      <Label className="font-bold text-primary flex items-center gap-2">
                        <Video className="w-4 h-4" /> YouTube / Multimedia
                      </Label>
                      <div className="space-y-2">
                        {formData.youtubeLinks?.map((it, i) => (
                          <div key={i} className="flex gap-2">
                            <Input value={it} disabled={isFormDisabled} onChange={e => { const a=[...formData.youtubeLinks!]; a[i]=e.target.value; setFormData({...formData, youtubeLinks:a}) }} placeholder="YouTube Video URL" />
                            {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, youtubeLinks: formData.youtubeLinks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                          </div>
                        ))}
                        {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, youtubeLinks: [...(formData.youtubeLinks||[]), '']})} className="text-primary h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Add Video Link</Button>}
                      </div>
                   </div>

                   <div className="space-y-4 md:col-span-2">
                      <Label className="font-bold text-primary flex items-center gap-2">
                        <Globe className="w-4 h-4" /> Websites & Digital Portals
                      </Label>
                      <div className="space-y-2">
                        {formData.websiteLinks?.map((it, i) => (
                          <div key={i} className="flex gap-2">
                            <Input value={it} disabled={isFormDisabled} onChange={e => { const a=[...formData.websiteLinks!]; a[i]=e.target.value; setFormData({...formData, websiteLinks:a}) }} placeholder="Academic Portal or Documentation URL" />
                            {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, websiteLinks: formData.websiteLinks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                          </div>
                        ))}
                        {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, websiteLinks: [...(formData.websiteLinks||[]), '']})} className="text-primary h-8"><Plus className="w-3.5 h-3.5 mr-1" /> Add Portal URL</Button>}
                      </div>
                   </div>
                 </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6">
                 <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 mb-6">
                    <h3 className="font-bold text-lg text-primary flex items-center gap-2">
                      <GraduationCap className="w-5 h-5" /> 
                      CO-PO Correlation Matrix
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Map Course Outcomes (COs) to Program Outcomes (POs). 
                      Levels: 1: Slight (Low), 2: Moderate (Medium), 3: Substantial (High), -: No Correlation.
                    </p>
                 </div>

                 <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <ScrollArea className="w-full">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="w-[250px] font-black text-[10px] uppercase">Course Outcome (CO)</TableHead>
                            {PROGRAM_OUTCOMES.map(po => (
                              <TableHead key={po.code} className="text-center font-black text-[10px] uppercase min-w-[60px]" title={po.title}>
                                {po.code}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(formData.units || []).map((unit, uIdx) => (
                            <TableRow key={unit.id} className="hover:bg-muted/10 transition-colors">
                              <TableCell className="py-4">
                                <div className="space-y-1">
                                  <Badge variant="outline" className="text-[9px] font-black bg-primary/5 text-primary border-primary/10">CO{uIdx + 1}</Badge>
                                  <p className="text-[10px] text-muted-foreground italic leading-tight truncate max-w-[200px]" title={unit.courseOutcome}>
                                    {unit.courseOutcome || "Outcome not defined"}
                                  </p>
                                </div>
                              </TableCell>
                              {PROGRAM_OUTCOMES.map(po => (
                                <TableCell key={po.code} className="p-1">
                                  <Select 
                                    disabled={isFormDisabled}
                                    value={formData.poMappings?.[unit.id]?.[po.code] || '-'} 
                                    onValueChange={(v: CorrelationLevel) => handlePOMapping(unit.id, po.code, v)}
                                  >
                                    <SelectTrigger className="h-8 border-none bg-transparent hover:bg-muted/50 focus:ring-0 text-center font-bold text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="-">-</SelectItem>
                                      <SelectItem value="1">1</SelectItem>
                                      <SelectItem value="2">2</SelectItem>
                                      <SelectItem value="3">3</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                 </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0 shadow-lg">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">Cancel</Button>
           {canEdit && (
             <Button 
              onClick={() => { onSave(formData); onOpenChange(false); }} 
              className="h-11 px-8 shadow-md"
              disabled={isEstablishingLink}
             >
               {isEstablishingLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
               Save Subject Pattern
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
