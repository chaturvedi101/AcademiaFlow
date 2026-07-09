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
  Sparkles, FlaskConical, ShieldCheck, Layers, Globe, Video, GraduationCap, Clock, Link as LinkIcon, AlertTriangle, Unlink
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

  const filteredParentSyllabi = useMemo(() => {
    return availableParentSyllabi.filter(s => s.type === formData.type);
  }, [availableParentSyllabi, formData.type]);

  const timetableClash = useMemo(() => {
    if (!formData.timetableSlot || !formData.semester || !allSyllabi) return null;
    return allSyllabi.find(s => 
      s.semester === formData.semester && 
      s.timetableSlot === formData.timetableSlot && 
      s.id !== formData.id
    );
  }, [formData.timetableSlot, formData.semester, formData.id, allSyllabi]);

  const isLinked = !!formData.followedFromId;
  /**
   * CRITICAL SECURITY RULE:
   * 1. If linked, pedagogical content is READ-ONLY for everyone. This ensures changes only occur at the parent authority.
   * 2. To change child content, the link MUST be severed (making it a local copy).
   * 3. This guarantees modifications in child can never reflect back to parent.
   */
  const isFormDisabled = isLinked || !canEdit;

  useEffect(() => {
    if (!open || !canEdit || formData.followedFromId) return;
    
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
        toast({ title: "Institutional Standard Established", description: "This child slot now mirrors the master content." });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Linking Failed", description: e.message });
    } finally {
      setIsEstablishingLink(false);
    }
  };

  const severMirrorLink = () => {
    setFormData(prev => ({
      ...prev,
      followedFromId: '',
      parentSchemeId: '',
      parentCode: '',
      standardizedFrom: undefined,
      isStandardized: false
    }));
    setWantsToLink(false);
    toast({ title: "Mirror Severed", description: "You are now editing a private local copy. Changes will not affect the master." });
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
              <Button onClick={handleAiGenerate} disabled={isAiGenerating || !formData.title || isLinked || !canEdit} variant="outline" className="gap-2">
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
            {isLinked && (
              <Alert className="bg-emerald-50 border-emerald-200 shadow-sm">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <AlertTitle className="font-bold text-emerald-800 flex items-center justify-between">
                  Institutional Mirror Active (Read-Only)
                  <Button variant="outline" size="sm" className="h-7 text-red-600 border-red-200 bg-white hover:bg-red-50 gap-2" onClick={severMirrorLink}>
                    <Unlink className="w-3.5 h-3.5" /> Sever Link for Local Override
                  </Button>
                </AlertTitle>
                <AlertDescription className="text-emerald-700 text-xs">
                  This slot currently inherits all content from Master: <b>{formData.parentCode}</b>. 
                  Modifications at this level are disabled to maintain university alignment. Use "Sever Link" to branch off.
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
                {!isLinked && canEdit && (
                  <Card className="border-dashed border-primary/20 bg-primary/5">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="font-bold flex items-center gap-2 text-primary">
                          <LinkIcon className="w-4 h-4" /> Link to Institutional Master?
                        </Label>
                        <Switch checked={wantsToLink} onCheckedChange={setWantsToLink} />
                      </div>
                      
                      {wantsToLink && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t mt-2">
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold">Source Authority Pool</Label>
                            <Select value={selectedLinkSchemeId} onValueChange={setSelectedLinkSchemeId}>
                              <SelectTrigger className="bg-white"><SelectValue placeholder="Choose Pool..." /></SelectTrigger>
                              <SelectContent>
                                {allSchemes.map(s => (
                                  <SelectItem key={s.id} value={s.id}>{s.branch} ({s.batchYear})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold">Master Course ({formData.type})</Label>
                            <Select disabled={!selectedLinkSchemeId || isFetchingParentSyllabi} onValueChange={handleEstablishLink}>
                              <SelectTrigger className="bg-white">
                                <SelectValue placeholder={isFetchingParentSyllabi ? "Pinging..." : "Select standard..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {filteredParentSyllabi.map(s => <SelectItem key={s.id} value={s.id}>{s.subjectCode} - {s.title}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credit Category</Label>
                    <Select disabled={isLinked || !canEdit || !!syllabus?.id} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                    <Input disabled={isFormDisabled} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                </div>

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
           {canEdit && (
             <Button onClick={() => { onSave(formData); onOpenChange(false); }} className="h-11 px-8 shadow-md" disabled={isEstablishingLink}>
               {isEstablishingLink ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
               Save Subject Pattern
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
