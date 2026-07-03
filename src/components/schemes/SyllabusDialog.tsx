"use client";

import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  BookOpen, Loader2, Plus, Clock, AlertTriangle, 
  ShieldCheck, ChevronDown, ChevronUp, Trash2, Lock, CheckCircle2, ShieldAlert, Eye, Sparkles, Wand2, FlaskConical
} from "lucide-react";
import { Syllabus, CreditRules, UserProfile, CreditCategory, SubjectType, SyllabusUnit } from "@/lib/types";
import { useFirestore } from "@/firebase";
import { query, getDocs, collectionGroup, where } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";

const PO_DEFINITIONS = [
  { code: 'PO1', title: 'Engineering Knowledge' },
  { code: 'PO2', title: 'Problem Analysis' },
  { code: 'PO3', title: 'Design/Development' },
  { code: 'PO4', title: 'Investigations' },
  { code: 'PO5', title: 'Modern Tool Usage' },
  { code: 'PO6', title: 'Engineer and Society' },
  { code: 'PO7', title: 'Environment' },
  { code: 'PO8', title: 'Ethics' },
  { code: 'PO9', title: 'Team Work' },
  { code: 'PO10', title: 'Communication' },
  { code: 'PO11', title: 'Project Management' },
  { code: 'PO12', title: 'Life-long Learning' },
];

const ALL_CATEGORIES: CreditCategory[] = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  existingSyllabi?: Syllabus[];
  onSave: (data: Partial<Syllabus>) => void;
  programName?: string;
  branchPrefix?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  currentSchemeId?: string;
  programRules?: CreditRules;
  batchYear?: string;
  userProfile?: UserProfile;
}

export function SyllabusDialog({ 
  open, 
  onOpenChange, 
  syllabus, 
  onSave,
  canEdit = true,
  currentSchemeId,
  userProfile,
  existingSyllabi = [],
  branchPrefix = 'XX'
}: SyllabusDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [codeWarning, setCodeWarning] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{ schemeId: string, title: string } | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [isCodeUnique, setIsCodeUnique] = useState<boolean | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
    timetableSlot: '', electiveGroupId: ''
  });

  const isAdmin = userProfile?.role === 'admin';
  const isCommonBOS = userProfile?.faculty === 'University-wide (Common BOS)';

  const itemLabel = formData.type === 'Lab/Sessional' ? 'Experiment' : 'Unit';
  const minItems = formData.type === 'Lab/Sessional' ? 8 : 5;

  const visibleCategories = useMemo(() => {
    if (isAdmin || userProfile?.role === 'dean_academic') return ALL_CATEGORIES;
    if (isCommonBOS) return ['VAC', 'MDC', 'AEC', 'OFE'] as CreditCategory[];
    return ['DSC', 'DSE', 'SEC', 'PRJ', 'OFE'] as CreditCategory[];
  }, [isAdmin, userProfile, isCommonBOS]);

  useEffect(() => {
    if (open && syllabus) {
      const existingUnits = syllabus.units || [];
      let finalUnits = [...existingUnits];
      
      const isMonitor = userProfile?.role === 'monitor';
      const canCurrentlyEdit = canEdit && !isMonitor;
      
      // Determine initial target count based on methodology
      const targetCount = (syllabus.type === 'Lab/Sessional' || formData.type === 'Lab/Sessional') ? 8 : 5;

      if (canCurrentlyEdit && finalUnits.length < targetCount) {
        const needed = targetCount - finalUnits.length;
        const newUnits: SyllabusUnit[] = Array.from({ length: needed }).map(() => ({
          id: Math.random().toString(36).substr(2, 9),
          title: '',
          content: '',
          hours: 0,
          courseOutcome: ''
        }));
        finalUnits = [...finalUnits, ...newUnits];
      }

      setFormData({ 
        subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
        credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', 
        poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
        timetableSlot: '', electiveGroupId: '',
        ...syllabus,
        units: finalUnits
      });

      setCodeWarning(null);
      setConflictInfo(null);
      setIsCodeUnique(null);
      
      const initialExpanded: Record<string, boolean> = {};
      finalUnits.forEach(u => initialExpanded[u.id] = true);
      setExpandedUnits(initialExpanded);
    }
  }, [open, syllabus, userProfile, canEdit]);

  // Adjust units if type changes manually
  useEffect(() => {
    if (open && formData.type) {
      const targetCount = formData.type === 'Lab/Sessional' ? 8 : 5;
      if (formData.units && formData.units.length < targetCount) {
        const needed = targetCount - formData.units.length;
        const newItems: SyllabusUnit[] = Array.from({ length: needed }).map(() => ({
          id: Math.random().toString(36).substr(2, 9),
          title: '',
          content: '',
          hours: 0,
          courseOutcome: ''
        }));
        setFormData(prev => ({ ...prev, units: [...(prev.units || []), ...newItems] }));
      }
    }
  }, [formData.type]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    
    let creditTotal = 0;
    if (p > 0) {
      if (p === 1) creditTotal = 0.5;
      else if (p === 2) creditTotal = 1.0;
      else if (p === 3) creditTotal = 2.0;
      else if (p === 4) creditTotal = 2.0;
      else creditTotal = p / 2;
    } else {
      creditTotal = l + t;
    }
    
    setFormData(prev => ({ ...prev, credits: Number(creditTotal.toFixed(2)) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits, formData.type]);

  const checkCodeUniqueness = async (code: string) => {
    if (!code) {
      setIsCodeUnique(null);
      setConflictInfo(null);
      return;
    }
    if (code === syllabus?.subjectCode) {
      setIsCodeUnique(true);
      setCodeWarning(null);
      setConflictInfo(null);
      return;
    }

    setIsCheckingUniqueness(true);
    try {
      const q = query(collectionGroup(db, 'syllabi'), where('subjectCode', '==', code));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const docData = snap.docs[0].data() as Syllabus;
        setIsCodeUnique(false);
        setCodeWarning(`Institutional Conflict: Code ${code} is already registered.`);
        setConflictInfo({ schemeId: docData.schemeId, title: docData.title });
      } else {
        setIsCodeUnique(true);
        setCodeWarning(null);
        setConflictInfo(null);
      }
    } catch (e) {
      console.error("Uniqueness audit failed:", e);
    } finally {
      setIsCheckingUniqueness(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!formData.title || formData.title === 'DSC' || formData.title === 'DSE') {
      toast({ title: "Input Required", description: "Please enter a descriptive course title for the AI to research.", variant: "destructive" });
      return;
    }

    setIsAiGenerating(true);
    try {
      const result = await generateSyllabusContent({
        title: formData.title,
        category: formData.creditCategory,
        credits: formData.credits,
        type: formData.type
      });

      const mappedUnits: SyllabusUnit[] = result.units.map(u => ({
        id: Math.random().toString(36).substr(2, 9),
        title: u.title,
        content: u.content,
        hours: u.hours,
        courseOutcome: u.courseOutcome
      }));

      setFormData(prev => ({
        ...prev,
        units: mappedUnits,
        textBooks: result.suggestedTextBooks,
        referenceBooks: result.suggestedReferences
      }));

      const newExpanded: Record<string, boolean> = {};
      mappedUnits.forEach(u => newExpanded[u.id] = true);
      setExpandedUnits(newExpanded);

      toast({ 
        title: "Content Generated", 
        description: `The AI has researched and drafted ${mappedUnits.length} ${formData.type === 'Lab/Sessional' ? 'experiments' : 'units'}. Please review and modify.` 
      });
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const isAuthorized = useMemo(() => {
    if (!userProfile || userProfile.role === 'monitor') return false; 
    const isInstitutional = ['AEC', 'VAC', 'MDC'].includes(formData.creditCategory || '');
    if (isInstitutional) return isAdmin || isCommonBOS;
    return canEdit;
  }, [userProfile, formData.creditCategory, canEdit, isAdmin, isCommonBOS]);

  const isReadOnly = !isAuthorized;
  const isCoreCategory = formData.creditCategory === 'DSC' || formData.creditCategory === 'PRJ' || formData.creditCategory === 'SEC';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              {formData.type === 'Lab/Sessional' ? <FlaskConical className="w-6 h-6 text-accent" /> : <BookOpen className="w-6 h-6 text-primary" />} 
              {isReadOnly ? 'Subject Specification (Locked)' : 'Course Architect'}
            </div>
            {!isReadOnly && (
              <Button 
                onClick={handleAiGenerate} 
                disabled={isAiGenerating} 
                variant="outline" 
                className="gap-2 border-primary/20 hover:bg-primary/5 hover:text-primary animate-in fade-in slide-in-from-right-4"
              >
                {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                {isAiGenerating ? "Researching Content..." : "AI Syllabus Architect"}
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {isAdmin ? 'System Admin View: Institutional auditing enabled.' : 'Institutional Course Architect. Use AI to research and draft content, then modify manually.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full min-h-0 bg-muted/5">
          <div className="p-6 space-y-8">
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Identity</TabsTrigger>
                <TabsTrigger value="syllabus">Content</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="mapping">Outcomes</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credit Category</Label>
                    <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => {
                      const updates: Partial<Syllabus> = { creditCategory: v };
                      if (v === 'DSC' || v === 'PRJ' || v === 'SEC') updates.electiveGroupId = '';
                      setFormData({...formData, ...updates});
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {visibleCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                    <Input disabled={isReadOnly} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Data Structures" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                      Subject Code 
                      {!isAdmin && <Lock className="w-3 h-3 text-amber-600" />}
                    </Label>
                    <div className="relative">
                      <Input 
                        disabled={!isAdmin} 
                        value={formData.subjectCode || ''} 
                        onChange={e => {
                          const val = e.target.value.toUpperCase();
                          setFormData({...formData, subjectCode: val});
                          if (val.length >= 7) checkCodeUniqueness(val);
                        }}
                        className={cn(
                          !isAdmin && "bg-muted/50 cursor-not-allowed font-bold text-primary",
                          isCodeUnique === false && "border-destructive text-destructive focus-visible:ring-destructive",
                          isCodeUnique === true && "border-emerald-500 text-emerald-600"
                        )}
                      />
                      {isCheckingUniqueness && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin opacity-50" />}
                    </div>
                    {codeWarning && (
                      <div className="flex flex-col gap-1 mt-1 p-2 bg-red-50 border border-red-100 rounded text-destructive">
                        <p className="text-[10px] font-bold flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          {codeWarning}
                        </p>
                        {conflictInfo && (
                          <>
                            <p className="text-[9px] font-bold opacity-80 ml-4">Conflicting with: {conflictInfo.title}</p>
                            <p className="text-[9px] font-mono opacity-60 ml-4">Scheme ID: {conflictInfo.schemeId}</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Methodology</Label>
                    <Select 
                      disabled={isReadOnly} 
                      value={formData.type || 'Theory'} 
                      onValueChange={(v: SubjectType) => {
                        const updates: Partial<Syllabus> = { 
                          type: v,
                          practicalCredits: v === 'Theory' ? 0 : formData.practicalCredits,
                          lectureCredits: v === 'Lab/Sessional' ? 0 : formData.lectureCredits,
                          tutorialCredits: v === 'Lab/Sessional' ? 0 : formData.tutorialCredits
                        };
                        setFormData({...formData, ...updates});
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory (L-T)</SelectItem>
                        <SelectItem value="Lab/Sessional">Lab/Sessional (P)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">
                      {isCoreCategory ? 'Elective Pool ID (Locked)' : 'Elective Group ID'}
                    </Label>
                    <Input 
                      disabled={isReadOnly || isCoreCategory} 
                      value={isCoreCategory ? 'CORE SUBJECT' : (formData.electiveGroupId || '')} 
                      onChange={e => setFormData({...formData, electiveGroupId: e.target.value})} 
                      placeholder={isCoreCategory ? '' : "e.g. Elective-I"}
                      className={isCoreCategory ? "bg-muted/50 font-medium" : ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credits</Label>
                    <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary border border-primary/20">
                      {formData.credits || 0} Cr
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border rounded-xl shadow-sm">
                    {formData.type === 'Theory' ? (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">L (Lecture)</Label>
                          <Input type="number" disabled={isReadOnly} value={formData.lectureCredits || 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold">T (Tutorial)</Label>
                          <Input type="number" disabled={isReadOnly} value={formData.tutorialCredits || 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[10px] uppercase font-bold">P (Practical)</Label>
                        <Input type="number" disabled={isReadOnly} value={formData.practicalCredits || 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Slot</Label>
                      <Input disabled={isReadOnly} value={formData.timetableSlot || ''} onChange={e => setFormData({...formData, timetableSlot: e.target.value.toUpperCase()})} placeholder="1 or A" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold">Semester</Label>
                      <Input type="number" disabled={isReadOnly} value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} />
                    </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted overflow-hidden">
                     <CardHeader 
                      className="p-4 bg-muted/20 flex flex-row items-center justify-between cursor-pointer"
                      onClick={() => setExpandedUnits(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                     >
                        <div className="flex items-center gap-3">
                          <Badge className={cn("border-none", formData.type === 'Lab/Sessional' ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary")}>
                            {itemLabel} {i+1}
                          </Badge>
                          <span className="font-bold">{u.title || `Untitled ${itemLabel}`}</span>
                          {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                        <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <Input className="w-16 h-8 text-center" value={u.hours || 0} type="number" disabled={isReadOnly} onChange={e => {
                              const units = [...(formData.units || [])];
                              units[i] = { ...units[i], hours: Number(e.target.value) };
                              setFormData({ ...formData, units });
                            }} />
                          </div>
                          {!isReadOnly && formData.units && formData.units.length > minItems && (
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => setFormData(prev => ({...prev, units: prev.units?.filter(unit => unit.id !== u.id)}))}><Trash2 className="w-4 h-4" /></Button>
                          )}
                        </div>
                     </CardHeader>
                     <CardContent className={cn("p-4 space-y-4", !expandedUnits[u.id] && "hidden")}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Title</Label><Input disabled={isReadOnly} value={u.title || ''} onChange={e => { const units = [...(formData.units || [])]; units[i] = { ...units[i], title: e.target.value }; setFormData({ ...formData, units }); }} /></div>
                           <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Outcome</Label><Input disabled={isReadOnly} value={u.courseOutcome || ''} onChange={e => { const units = [...(formData.units || [])]; units[i] = { ...units[i], courseOutcome: e.target.value }; setFormData({ ...formData, units }); }} /></div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase">
                            {formData.type === 'Lab/Sessional' ? 'Experiment Procedure / Details' : 'Unit Topics'}
                          </Label>
                          <Textarea disabled={isReadOnly} value={u.content || ''} onChange={e => { const units = [...(formData.units || [])]; units[i] = { ...units[i], content: e.target.value }; setFormData({ ...formData, units }); }} className="min-h-[120px]" />
                        </div>
                     </CardContent>
                   </Card>
                 ))}
                 {!isReadOnly && <Button variant="outline" className="w-full border-dashed" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(36).substr(2,9), title:'', content:'', hours:0, courseOutcome:''}]}))}><Plus className="w-4 h-4 mr-2" /> Add Additional {itemLabel}</Button>}
              </TabsContent>

              <TabsContent value="resources" className="space-y-8">
                 <ResourceSection title={formData.type === 'Lab/Sessional' ? "Lab Manuals & Standards" : "Text Books"} items={formData.textBooks||[]} onUpdate={(idx: number, v: string) => {const a=[...formData.textBooks!]; a[idx]=v; setFormData({...formData, textBooks:a})}} onAdd={() => setFormData({...formData, textBooks:[...(formData.textBooks||[]), '']})} onRemove={(idx: number) => setFormData({...formData, textBooks: formData.textBooks?.filter((_, i) => i !== idx)})} disabled={isReadOnly} />
                 <ResourceSection title={formData.type === 'Lab/Sessional' ? "Software / Equipment List" : "Reference Books"} items={formData.referenceBooks||[]} onUpdate={(idx: number, v: string) => {const a=[...formData.referenceBooks!]; a[idx]=v; setFormData({...formData, referenceBooks:a})}} onAdd={() => setFormData({...formData, referenceBooks:[...(formData.referenceBooks||[]), '']})} onRemove={(idx: number) => setFormData({...formData, referenceBooks: formData.referenceBooks?.filter((_, i) => i !== idx)})} disabled={isReadOnly} />
              </TabsContent>

              <TabsContent value="mapping">
                 <div className="border rounded-xl overflow-hidden bg-white">
                   <Table>
                     <TableHeader className="bg-muted/50">
                       <TableRow>
                         <TableHead className="w-20">{formData.type === 'Lab/Sessional' ? 'Exp' : 'CO'}</TableHead>
                         {PO_DEFINITIONS.map(po => <TableHead key={po.code} className="text-center font-mono text-[10px]">{po.code}</TableHead>)}
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {formData.units?.map((u, ui) => (
                         <TableRow key={u.id}>
                           <TableCell className="font-bold">{formData.type === 'Lab/Sessional' ? `Exp${ui+1}` : `CO${ui+1}`}</TableCell>
                           {PO_DEFINITIONS.map(po => (
                             <TableCell key={po.code} className="p-1">
                               <Select disabled={isReadOnly} value={formData.poMappings?.[u.id]?.[po.code] || '-'} onValueChange={v => { const m={...(formData.poMappings||{})}; if(!m[u.id])m[u.id]={}; m[u.id][po.code]=v as any; setFormData({...formData, poMappings:m}) }}>
                                 <SelectTrigger className="h-8 w-14 text-[10px]"><SelectValue /></SelectTrigger>
                                 <SelectContent>
                                   {['1','2','3','-'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                 </SelectContent>
                               </Select>
                             </TableCell>
                           ))}
                         </TableRow>
                       ))}
                     </TableBody>
                   </Table>
                 </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0">
           <Button variant="outline" onClick={() => onOpenChange(false)}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
           {!isReadOnly && (
             <Button 
               disabled={isCodeUnique === false || isCheckingUniqueness || isAiGenerating} 
               onClick={() => { onSave(formData); onOpenChange(false); }}
             >
               {(isCheckingUniqueness || isAiGenerating) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
               Save {formData.type === 'Lab/Sessional' ? 'Practical' : 'Course'} Specification
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceSection({ title, items, onAdd, onUpdate, onRemove, disabled }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-primary">{title}</h4>
        {!disabled && <Button variant="ghost" size="sm" onClick={onAdd} className="h-7"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>}
      </div>
      <div className="space-y-2">
         {items.map((it: string, i: number) => (
            <div key={i} className="flex gap-2">
               <Input value={it} onChange={e => onUpdate(i, e.target.value)} disabled={disabled} className="text-sm" />
               {!disabled && <Button variant="ghost" size="icon" onClick={() => onRemove(i)} className="text-red-400"><Trash2 className="w-4 h-4" /></Button>}
            </div>
         ))}
      </div>
    </div>
  );
}
