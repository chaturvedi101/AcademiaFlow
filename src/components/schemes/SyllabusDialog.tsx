"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, Loader2, Plus, ChevronDown, ChevronUp, Trash2, 
  Sparkles, FlaskConical, AlertTriangle, ShieldCheck
} from "lucide-react";
import { Syllabus, UserProfile, CreditCategory, SubjectType, Scheme, Program } from "@/lib/types";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";

const ALL_CATEGORIES: CreditCategory[] = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
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
  onSave,
  canEdit = true,
  userProfile,
  program,
  scheme
}: SyllabusDialogProps) {
  const { toast } = useToast();

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
    followedFromId: ''
  });

  const isSuperuser = userProfile?.role === 'admin' || userProfile?.role === 'dean_academic';

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ 
        subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
        credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', 
        poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
        followedFromId: '',
        ...syllabus
      });
      // VIRTUAL AUTO-EXPAND: Automatically expand units for authorized standards
      if (syllabus.followedFromId || (syllabus as any).isInherited) {
        const expandMap: Record<string, boolean> = {};
        syllabus.units?.forEach(u => { expandMap[u.id] = true; });
        setExpandedUnits(expandMap);
      }
    }
  }, [open, syllabus]);

  const unitCount = formData.units?.length || 0;
  const isLab = formData.type === 'Lab/Sessional';
  const minRequired = isLab ? 8 : 5;
  const isCountValid = unitCount >= minRequired;
  const unitLabel = isLab ? 'Experiment' : 'Unit';

  // PEDAGOGICAL AUTO-CREATION: Proactively populate counts for compliance
  useEffect(() => {
    if (!open || !canEdit || formData.followedFromId) return;
    
    const currentUnits = formData.units || [];
    if (currentUnits.length === 0) {
      const required = isLab ? 8 : 5;
      const initialUnits = Array.from({ length: required }, (_, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: '',
        content: '',
        hours: isLab ? 2 : 8,
        courseOutcome: ''
      }));
      setFormData(prev => ({ ...prev, units: initialUnits }));
    }
  }, [formData.type, open, canEdit, formData.followedFromId]);

  // COURSE CODE RULES: RT prefix for common categories, Branch prefix for departmental slots
  useEffect(() => {
    if (!open || !program || !scheme || formData.followedFromId) return;
    
    const isInstitutionalScheme = scheme?.programId === 'INSTITUTIONAL' || scheme?.isVerticalPool || scheme?.isCommitteePool;
    const isCommonCategory = ['VAC', 'AEC', 'MDC'].includes(formData.creditCategory || '');
    
    const branchCode = (isInstitutionalScheme || isCommonCategory) 
      ? 'RT' 
      : (program.branchPrefixes?.[scheme.branch || ''] || 'XX');
      
    const pedagogyChar = formData.type === 'Lab/Sessional' ? 'P' : (formData.creditCategory === 'PRJ' ? 'I' : 'L');
    
    const getPillarChar = (cat: CreditCategory) => {
      switch(cat) {
        case 'DSC': return 'C';
        case 'DSE': case 'OFE': return 'E';
        case 'SEC': return 'S';
        case 'VAC': return 'V';
        case 'AEC': return 'A';
        case 'MDC': return 'M';
        case 'PRJ': return 'P';
        default: return 'C';
      }
    };

    const pillarChar = getPillarChar(formData.creditCategory || 'DSC');
    const yearDigit = Math.ceil((formData.semester || 1) / 2);
    const patternBase = `${branchCode}${pedagogyChar}${pillarChar}${yearDigit}`;
    
    if (!formData.subjectCode?.startsWith(patternBase)) {
      setFormData(prev => ({ ...prev, subjectCode: `${patternBase}01` }));
    }
  }, [formData.type, formData.creditCategory, formData.semester, program, scheme, open, formData.followedFromId]);

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

  // INSTITUTIONAL LOCK: Once a course is saved (has ID), its category cannot be changed to preserve sequence integrity
  const isCategoryLocked = isFormDisabled || !!syllabus?.id;

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
            Pedagogical Mandate: <b>{isLab ? '8+ Experiments' : '5+ Units'}</b>. Virtual child slots maintain local identity.
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
                    <p className="text-xs">Mirroring standard syllabus: <span className="font-black">{(formData as any).parentCode || 'BTECH Pool'}</span></p>
                  </div>
                </div>
                {isSuperuser && (
                  <Button variant="ghost" size="sm" className="text-emerald-700 hover:bg-emerald-100" onClick={() => setFormData({...formData, followedFromId: '', parentSchemeId: '', parentCode: ''})}>
                    Sever Link & Restore Slot
                  </Button>
                )}
              </div>
            )}

            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Mirror Identity</TabsTrigger>
                <TabsTrigger value="syllabus" className="gap-2">
                  Inherited Content 
                  <Badge variant={isCountValid ? "outline" : "destructive"} className="text-[10px] px-1.5 h-4 min-w-4 flex items-center justify-center">
                    {unitCount}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="resources">Institutional Resources</TabsTrigger>
                <TabsTrigger value="mapping">Outcomes</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
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
                    <Select disabled={isFormDisabled} value={formData.type || 'Theory'} onValueChange={(v: any) => setFormData({...formData, type: v, units: []})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory (L-T)</SelectItem>
                        <SelectItem value="Lab/Sessional">Practical (P)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Semester Slot</Label>
                    <Input disabled={isFormDisabled} type="number" value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Calculated Credits</Label>
                    <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary border border-primary/20">{formData.credits} Cr</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white border rounded-xl shadow-inner">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">L (Lecture)</Label>
                    <Input type="number" disabled={isFormDisabled} value={formData.lectureCredits || 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">T (Tutorial)</Label>
                    <Input type="number" disabled={isFormDisabled} value={formData.tutorialCredits || 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">P (Practical Hours)</Label>
                    <Input type="number" disabled={isFormDisabled} value={formData.practicalCredits || 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                 {!isCountValid && !isLinked && (
                   <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-sm mb-4">
                     <AlertTriangle className="w-5 h-5 shrink-0" />
                     <p><b>Institutional Warning:</b> {formData.type} courses mandate at least <b>{minRequired}</b> {unitLabel}s. Current: {unitCount}.</p>
                   </div>
                 )}
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted overflow-hidden shadow-sm">
                     <CardHeader 
                      className="p-4 bg-muted/20 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setExpandedUnits(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                     >
                        <div className="flex items-center gap-3">
                          <Badge className="bg-primary/10 text-primary border-none">{unitLabel} {i+1}</Badge>
                          <span className="font-bold">{u.title || `Untitled ${unitLabel}`}</span>
                          {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
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
                 <div className="space-y-4">
                    <Label className="font-bold text-primary flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Authoritative References
                    </Label>
                    {formData.textBooks?.map((it, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={it} disabled={isFormDisabled} onChange={e => { const a=[...formData.textBooks!]; a[i]=e.target.value; setFormData({...formData, textBooks:a}) }} placeholder="Standard Text Book Details" />
                        {!isFormDisabled && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, textBooks: formData.textBooks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                      </div>
                    ))}
                    {!isFormDisabled && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, textBooks: [...(formData.textBooks||[]), '']})} className="text-primary"><Plus className="w-3.5 h-3.5 mr-1" /> Add Textbook</Button>}
                 </div>
              </TabsContent>

              <TabsContent value="mapping" className="p-8 text-center text-muted-foreground italic bg-white rounded-xl border border-dashed">
                 <p>PO/PSO Correlations are mirrored from the authoritative standard for synchronized virtual slots.</p>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0 shadow-lg">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">Cancel</Button>
           {!isFormDisabled && (
             <Button 
              disabled={!isCountValid} 
              onClick={() => { onSave(formData); onOpenChange(false); }} 
              className="h-11 px-8 shadow-md"
             >
               Save Subject Pattern
             </Button>
           )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
