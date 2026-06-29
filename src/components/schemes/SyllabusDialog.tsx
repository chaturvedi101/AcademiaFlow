"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  BookOpen, Loader2, Plus, Sparkles, Clock, AlertTriangle, 
  Info, Cpu, ChevronDown, ChevronUp, Trash2, ShieldAlert, ShieldCheck,
  Search, ListChecks, ArrowRight, Settings2
} from "lucide-react";
import { Syllabus, CreditRules, CreditCategory, UserProfile } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from "@/firebase";
import { query, getDocs, collectionGroup, where } from "firebase/firestore";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { cn } from "@/lib/utils";

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

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  existingSyllabi?: Syllabus[];
  onSave: (data: Partial<Syllabus>) => void;
  programName?: string;
  branchName?: string;
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
  existingSyllabi = [],
  onSave,
  branchName,
  canEdit = true,
  currentSchemeId,
  userProfile,
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [showAIPlanner, setShowAIPlanner] = useState(false);
  const [selectedModel, setSelectedModel] = useState('googleai/gemini-flash-latest');
  const [unitCount, setUnitCount] = useState(5);
  const [confirmations, setConfirmations] = useState({ title: false, credits: false, hours: false });
  
  const [codeWarning, setCodeWarning] = useState<string | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
    timetableSlot: ''
  });

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ 
        subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
        credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
        poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
        timetableSlot: '',
        ...syllabus 
      });
      setCodeWarning(null);
      setShowAIPlanner(false);
      setConfirmations({ title: false, credits: false, hours: false });
      const initialExpanded: Record<string, boolean> = {};
      syllabus.units?.forEach(u => initialExpanded[u.id] = true);
      setExpandedUnits(initialExpanded);
    }
  }, [open, syllabus]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    const pCr = p === 3 ? 2 : p / 2;
    setFormData(prev => ({ ...prev, credits: Number((l + t + pCr).toFixed(2)) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  useEffect(() => {
    if (!open || !formData.subjectCode || formData.subjectCode.length < 4) return;
    const checkCode = async () => {
      setIsCheckingUniqueness(true);
      try {
        const q = query(collectionGroup(db, 'syllabi'), where('subjectCode', '==', formData.subjectCode));
        const snap = await getDocs(q);
        const existing = snap.docs.find(d => d.data().schemeId !== currentSchemeId);
        
        if (existing) {
          const data = existing.data() as Syllabus;
          setCodeWarning(`Institutional Code Detected: Existing syllabus for "${data.title}" found.`);
          
          // Only overwrite if current title is a generic placeholder
          const currentTitle = formData.title || '';
          const isGeneric = currentTitle.includes('Slot') || currentTitle.includes('Elective') || !currentTitle.trim();
          
          if (isGeneric && (!formData.id || formData.isSlot)) {
            setFormData(prev => ({ 
              ...prev, 
              title: data.title, 
              units: data.units || [], 
              credits: data.credits,
              lectureCredits: data.lectureCredits || 0, 
              tutorialCredits: data.tutorialCredits || 0,
              practicalCredits: data.practicalCredits || 0, 
              timetableSlot: data.timetableSlot || prev.timetableSlot
            }));
          }
        } else {
          setCodeWarning(null);
        }
      } catch (e) { console.error(e); } finally { setIsCheckingUniqueness(false); }
    };
    const t = setTimeout(checkCode, 800);
    return () => clearTimeout(t);
  }, [formData.subjectCode, currentSchemeId, db, open]);

  const handleAISyllabus = async () => {
    if (!formData.title) return toast({ title: "Title Required", variant: "destructive" });
    setIsGenerating(true);
    
    try {
      const prevCourses = existingSyllabi
        .filter(s => (s.semester || 1) < (formData.semester || 1))
        .map(s => s.title);
        
      const peerCourses = existingSyllabi
        .filter(s => s.semester === formData.semester && s.id !== formData.id)
        .map(s => s.title);

      const res = await generateSyllabusContent({ 
        title: formData.title!, 
        subjectCode: formData.subjectCode,
        unitCount: unitCount,
        level: formData.semester && formData.semester > 8 ? 'PG' : 'UG',
        branch: branchName,
        semester: formData.semester,
        previousCourses: prevCourses,
        peerCourses: peerCourses,
        totalHours: (formData.lectureCredits || 0) * 14, 
        modelId: selectedModel 
      });

      const newUnits = res.units.map(u => ({ ...u, id: Math.random().toString(36).substr(2, 9) }));
      setFormData(p => ({ 
        ...p, 
        units: newUnits, 
        textBooks: res.suggestedTextBooks, 
        referenceBooks: res.suggestedReferences 
      }));
      
      const newExpanded: Record<string, boolean> = {};
      newUnits.forEach(u => newExpanded[u.id] = true);
      setExpandedUnits(newExpanded);
      
      toast({ title: "AI Generation Complete", description: `Drafted ${unitCount} units using academic context.` });
      setShowAIPlanner(false);
    } catch (e: any) { 
      console.error("AI Generation Error:", e);
      toast({ 
        variant: "destructive", 
        title: "AI Generation Failed", 
        description: e.message || "Could not connect to AI services. Verify your API key in Diagnostics."
      }); 
    } finally { setIsGenerating(false); }
  };

  const isAuthorized = useMemo(() => {
    if (!userProfile || userProfile.role === 'monitor') return false; 
    const isInstitutional = ['AEC', 'VAC', 'MDC'].includes(formData.creditCategory || '');
    if (isInstitutional) return ['admin', 'dean_academic'].includes(userProfile.role) || userProfile.faculty === 'University-wide (Common BOS)';
    return canEdit;
  }, [userProfile, formData.creditCategory, canEdit]);

  const isReadOnly = !isAuthorized;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-primary" /> 
              {isReadOnly ? 'Subject Specification (Locked)' : 'Course Architect'}
              {isReadOnly && userProfile?.role === 'monitor' && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1">
                  <ShieldCheck className="w-3 h-3" /> Monitoring Access
                </Badge>
              )}
            </div>
            {!isReadOnly && !showAIPlanner && (
              <Button size="sm" onClick={() => setShowAIPlanner(true)} disabled={isGenerating || !formData.title} className="gap-2 bg-gradient-to-r from-primary to-indigo-600">
                <Sparkles className="w-4 h-4" /> GenAI Architect
              </Button>
            )}
            {showAIPlanner && (
               <Button variant="ghost" size="sm" onClick={() => setShowAIPlanner(false)}>Cancel Planning</Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'University standard definition. Editing restricted.' : 'Configure course identity and trigger context-aware AI generation.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full min-h-0 bg-muted/5">
          {showAIPlanner ? (
            <div className="p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
              <div className="space-y-2">
                <h3 className="text-xl font-headline font-bold flex items-center gap-2">
                  <Settings2 className="w-5 h-5 text-primary" /> 
                  Academic Context Planner
                </h3>
                <p className="text-sm text-muted-foreground">Confirm context and specify parameters for the AI curriculum search.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><ListChecks className="w-4 h-4" /> Validate Structure</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="c-title" checked={confirmations.title} onCheckedChange={(v) => setConfirmations({...confirmations, title: !!v})} />
                      <Label htmlFor="c-title" className="text-xs">Title: <b>{formData.title || 'N/A'}</b> is correct</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="c-credits" checked={confirmations.credits} onCheckedChange={(v) => setConfirmations({...confirmations, credits: !!v})} />
                      <Label htmlFor="c-credits" className="text-xs">Distribution: <b>{formData.lectureCredits || 0}-{formData.tutorialCredits || 0}-{formData.practicalCredits || 0} (L-T-P)</b> is correct</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox id="c-hours" checked={confirmations.hours} onCheckedChange={(v) => setConfirmations({...confirmations, hours: !!v})} />
                      <Label htmlFor="c-hours" className="text-xs">Credits: <b>{formData.credits || 0} Cr</b> total is correct</Label>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-accent" /> Generation Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-bold uppercase">Syllabus Depth (Units)</Label>
                        <Badge variant="secondary" className="font-mono">{unitCount}</Badge>
                      </div>
                      <Slider value={[unitCount]} min={1} max={10} step={1} onValueChange={([v]) => setUnitCount(v)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase">AI Engine</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="googleai/gemini-flash-latest">Gemini Flash (Standard)</SelectItem>
                          <SelectItem value="googleai/gemini-pro-latest">Gemini Pro (Deep Reasoning)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-white border rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3 text-emerald-600">
                  <Search className="w-5 h-5" />
                  <h4 className="font-bold">Automated Continuity Check</h4>
                </div>
                <div className="grid grid-cols-2 gap-8 text-[11px]">
                  <div className="space-y-2">
                    <p className="font-bold uppercase text-muted-foreground tracking-widest">Prerequisite Background</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {existingSyllabi.filter(s => (s.semester || 1) < (formData.semester || 1)).slice(0, 4).map(s => <li key={s.id}>{s.title}</li>)}
                      {existingSyllabi.filter(s => (s.semester || 1) < (formData.semester || 1)).length === 0 && <li className="italic">No previous subjects detected.</li>}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold uppercase text-muted-foreground tracking-widest">Semester Peers</p>
                    <ul className="list-disc pl-4 space-y-1">
                      {existingSyllabi.filter(s => s.semester === formData.semester && s.id !== formData.id).slice(0, 4).map(s => <li key={s.id}>{s.title}</li>)}
                      {existingSyllabi.filter(s => s.semester === formData.semester && s.id !== formData.id).length === 0 && <li className="italic">No peers detected.</li>}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button 
                  size="lg" 
                  onClick={handleAISyllabus} 
                  disabled={isGenerating || !confirmations.title || !confirmations.credits || !confirmations.hours}
                  className="h-14 px-12 text-lg gap-3 shadow-xl shadow-primary/20"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin w-6 h-6" /> 
                      Searching Net & Synthesizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" /> 
                      Initialize Generation
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-8">
              {codeWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex gap-3 text-sm">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">Institutional Link Detected</p>
                    <p className="text-xs">{codeWarning}</p>
                  </div>
                </div>
              )}
              <Tabs defaultValue="basic">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                  <TabsTrigger value="basic">Identity</TabsTrigger>
                  <TabsTrigger value="syllabus">Content</TabsTrigger>
                  <TabsTrigger value="resources">Resources</TabsTrigger>
                  <TabsTrigger value="mapping">Outcomes</TabsTrigger>
                </TabsList>
                <TabsContent value="basic" className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credit Category</Label>
                      <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {['DSC','DSE','OFE','VAC','AEC','SEC','MDC','PRJ'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                      <Input disabled={isReadOnly} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Data Structures" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Subject Code</Label>
                      <div className="relative">
                        <Input disabled={isReadOnly} value={formData.subjectCode || ''} onChange={e => setFormData({...formData, subjectCode: e.target.value.toUpperCase()})} />
                        {isCheckingUniqueness && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin opacity-50" />}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Methodology</Label>
                      <Select disabled={isReadOnly} value={formData.type || 'Theory'} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Theory">Theory</SelectItem>
                          <SelectItem value="Lab/Sessional">Lab/Sessional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Credits</Label>
                      <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary">{formData.credits || 0} Cr</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">L</Label><Input type="number" disabled={isReadOnly} value={formData.lectureCredits || 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">T</Label><Input type="number" disabled={isReadOnly} value={formData.tutorialCredits || 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">P</Label><Input type="number" disabled={isReadOnly} value={formData.practicalCredits || 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} /></div>
                      <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Slot</Label><Input disabled={isReadOnly} value={formData.timetableSlot || ''} onChange={e => setFormData({...formData, timetableSlot: e.target.value.toUpperCase()})} placeholder="1 or A" /></div>
                  </div>
                </TabsContent>
                <TabsContent value="syllabus" className="space-y-6">
                   {formData.units?.map((u, i) => (
                     <Card key={u.id} className="border-muted overflow-hidden">
                       <CardHeader 
                        className="p-4 bg-muted/20 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedUnits(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                       >
                          <div className="flex items-center gap-3">
                            <Badge className="bg-primary/10 text-primary border-none">Unit {i+1}</Badge>
                            <span className="font-bold truncate max-w-[400px]">{u.title || 'Untitled Unit'}</span>
                            {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
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
                            {!isReadOnly && <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => setFormData(prev => ({...prev, units: prev.units?.filter(unit => unit.id !== u.id)}))}><Trash2 className="w-4 h-4" /></Button>}
                          </div>
                       </CardHeader>
                       <CardContent className={cn("p-4 space-y-4", !expandedUnits[u.id] && "hidden")}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Title</Label><Input disabled={isReadOnly} value={u.title || ''} onChange={e => { const units = [...(formData.units || [])]; units[i] = { ...units[i], title: e.target.value }; setFormData({ ...formData, units }); }} /></div>
                             <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Outcome</Label><Input disabled={isReadOnly} value={u.courseOutcome || ''} onChange={e => { const units = [...(formData.units || [])]; units[i] = { ...units[i], courseOutcome: e.target.value }; setFormData({ ...formData, units }); }} /></div>
                          </div>
                          <div className="space-y-2"><Label className="text-[10px] font-bold uppercase">Content</Label><Textarea disabled={isReadOnly} value={u.content || ''} onChange={e => { const units = [...(formData.units || [])]; units[i] = { ...units[i], content: e.target.value }; setFormData({ ...formData, units }); }} className="min-h-[120px]" /></div>
                       </CardContent>
                     </Card>
                   ))}
                   {!isReadOnly && <Button variant="outline" className="w-full border-dashed" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(36).substr(2,9), title:'', content:'', hours:0, courseOutcome:''}]}))}><Plus className="w-4 h-4 mr-2" /> Add Unit</Button>}
                </TabsContent>
                <TabsContent value="resources" className="space-y-8">
                   <ResourceSection title="Text Books" items={formData.textBooks||[]} onUpdate={(idx: number, v: string) => {const a=[...formData.textBooks!]; a[idx]=v; setFormData({...formData, textBooks:a})}} onAdd={() => setFormData({...formData, textBooks:[...(formData.textBooks||[]), '']})} onRemove={(idx: number) => setFormData({...formData, textBooks: formData.textBooks?.filter((_, i) => i !== idx)})} disabled={isReadOnly} />
                   <ResourceSection title="Reference Books" items={formData.referenceBooks||[]} onUpdate={(idx: number, v: string) => {const a=[...formData.referenceBooks!]; a[idx]=v; setFormData({...formData, referenceBooks:a})}} onAdd={() => setFormData({...formData, referenceBooks:[...(formData.referenceBooks||[]), '']})} onRemove={(idx: number) => setFormData({...formData, referenceBooks: formData.referenceBooks?.filter((_, i) => i !== idx)})} disabled={isReadOnly} />
                </TabsContent>
                <TabsContent value="mapping">
                   <div className="border rounded-xl overflow-hidden bg-white"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="w-20">CO</TableHead>{PO_DEFINITIONS.map(po => <TableHead key={po.code} className="text-center font-mono text-[10px]">{po.code}</TableHead>)}</TableRow></TableHeader><TableBody>{formData.units?.map((u, ui) => (<TableRow key={u.id}><TableCell className="font-bold">CO{ui+1}</TableCell>{PO_DEFINITIONS.map(po => (<TableCell key={po.code} className="p-1"><Select disabled={isReadOnly} value={formData.poMappings?.[u.id]?.[po.code] || '-'} onValueChange={v => { const m={...(formData.poMappings||{})}; if(!m[u.id])m[u.id]={}; m[u.id][po.code]=v as any; setFormData({...formData, poMappings:m}) }}><SelectTrigger className="h-8 w-14 text-[10px]"><SelectValue /></SelectTrigger><SelectContent>{['1','2','3','-'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></TableCell>))}</TableRow>))}</TableBody></Table></div>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0">
           <Button variant="outline" onClick={() => onOpenChange(false)}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
           {!isReadOnly && !showAIPlanner && <Button onClick={() => { onSave(formData); onOpenChange(false); }}>Save Course Specification</Button>}
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
