"use client";

import { useState, useEffect, useCallback } from "react";
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
import { BookOpen, Loader2, Plus, Sparkles, Clock, AlertTriangle, Info, Cpu } from "lucide-react";
import { Syllabus, CreditRules, CreditCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useMemoFirebase } from "@/firebase";
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
  branchName?: string;
  canEdit?: boolean;
  canDelete?: boolean;
  currentSchemeId?: string;
  programRules?: CreditRules;
}

export function SyllabusDialog({ 
  open, 
  onOpenChange, 
  syllabus, 
  onSave,
  branchName,
  canEdit = true,
  currentSchemeId,
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();

  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState('googleai/gemini-flash-latest');
  const [codeWarning, setCodeWarning] = useState<string | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);

  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: []
  });

  const generateAutoCode = useCallback(() => {
    if (!branchName) return '';
    let prefix = branchName.substring(0, 2).toUpperCase();
    const cat = formData.creditCategory || '';
    if (cat === 'AEC') prefix = 'AE';
    else if (cat === 'MDC') prefix = 'MD';
    else if (cat === 'VAC') prefix = 'VA';

    let ped = formData.type === 'Lab/Sessional' ? 'P' : 'L';
    if (cat === 'PRJ') ped = 'I';
    const pillar = ['DSE', 'OFE'].includes(cat) ? 'E' : 'C';
    const year = Math.ceil((formData.semester || 1) / 2);
    
    let seq = 1;
    if (cat === 'SEC') seq = 40;
    if (['DSE', 'OFE'].includes(cat)) seq = 50;
    if (cat === 'PRJ') seq = 95;

    return `${prefix}${ped${pillar}${year}${String(seq).padStart(2, '0')}`;
  }, [branchName, formData.type, formData.semester, formData.creditCategory]);

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ ...formData, ...syllabus });
      setCodeWarning(null);
    }
  }, [open, syllabus]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    
    // AICTE Rule: 3h practical = 2 credits (special exception)
    // Otherwise 2:1 ratio (e.g. 2h = 1cr, 4h = 2cr)
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
          setCodeWarning(`Institutional Code Detected: This code is registered to "${data.title}" in another scheme. Saving will create a local branch-specific adaptation.`);
          if (!formData.id || formData.isSlot) {
            setFormData(prev => ({ ...prev, title: data.title, units: data.units || [], credits: data.credits }));
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
      const res = await generateSyllabusContent({ 
        title: formData.title, 
        unitCount: 5,
        modelId: selectedModel 
      });
      setFormData(p => ({ 
        ...p, 
        units: res.units.map(u => ({ ...u, id: Math.random().toString(36).substr(2, 9) })), 
        textBooks: res.suggestedTextBooks, 
        referenceBooks: res.suggestedReferences 
      }));
      toast({ title: "AI Generation Complete" });
    } catch (e: any) { 
      toast({ 
        variant: "destructive", 
        title: "AI Generation Failed", 
        description: e.message.includes('429') ? "Rate limit reached. Try switching to Gemini Pro." : "Could not connect to AI services."
      }); 
    } finally { setIsGenerating(false); }
  };

  const isReadOnly = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><BookOpen className="w-6 h-6 text-primary" /> {isReadOnly ? 'Subject Specification' : 'Course Architect'}</div>
            {!isReadOnly && (
              <div className="flex items-center gap-2">
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-[180px] h-9 text-xs">
                    <Cpu className="w-3.5 h-3.5 mr-2" />
                    <SelectValue placeholder="Select Model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="googleai/gemini-flash-latest">Gemini Flash (Fast)</SelectItem>
                    <SelectItem value="googleai/gemini-pro-latest">Gemini Pro (Smart)</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAISyllabus} disabled={isGenerating} className="gap-2">
                  {isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />} 
                  Generate Syllabus
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8">
            {codeWarning && (
              <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Institutional Code Detected</p>
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
                    <Label>Credit Category</Label>
                    <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['DSC','DSE','OFE','VAC','AEC','SEC','MDC','PRJ'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Course Title</Label>
                    <Input disabled={isReadOnly} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Subject Code</Label>
                    <div className="relative">
                      <Input disabled={isReadOnly} value={formData.subjectCode} onChange={e => setFormData({...formData, subjectCode: e.target.value.toUpperCase()})} />
                      {isCheckingUniqueness && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin opacity-50" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Teaching Methodology</Label>
                    <Select disabled={isReadOnly} value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory</SelectItem>
                        <SelectItem value="Lab/Sessional">Lab/Sessional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Calculated Credits</Label>
                    <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary">{formData.credits} Cr</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Lecture (L)</Label><Input type="number" disabled={isReadOnly} value={formData.lectureCredits} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} /></div>
                   <div className="space-y-1"><Label className="text-[10px] uppercase font-bold text-muted-foreground">Tutorial (T)</Label><Input type="number" disabled={isReadOnly} value={formData.tutorialCredits} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} /></div>
                   <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Practical (P)</Label>
                      <Input type="number" disabled={isReadOnly} value={formData.practicalCredits} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                      <div className="flex items-center gap-1 mt-1 text-[8px] text-muted-foreground">
                        <Info className="w-2.5 h-2.5" />
                        <span>AICTE Rule: 3H = 2Cr exception active</span>
                      </div>
                   </div>
                </div>
              </TabsContent>
              <TabsContent value="syllabus" className="space-y-6">
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted">
                     <CardHeader className="p-4 bg-muted/20 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-3"><Badge>Unit {i+1}</Badge><span className="font-bold">{u.title || 'Untitled Unit'}</span></div>
                        <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><Input className="w-16 h-8 text-center" value={u.hours} onChange={e => {const units=[...(formData.units||[])]; units[i].hours=Number(e.target.value); setFormData({...formData, units})}} /></div>
                     </CardHeader>
                     <CardContent className="p-4 space-y-4">
                        <Input placeholder="Unit Title" value={u.title} onChange={e => {const units=[...(formData.units||[])]; units[i].title=e.target.value; setFormData({...formData, units})}} />
                        <Textarea placeholder="Course content breakdown..." value={u.content} onChange={e => {const units=[...(formData.units||[])]; units[i].content=e.target.value; setFormData({...formData, units})}} className="min-h-[120px]" />
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Outcome (CO)</Label>
                          <Input placeholder="Learners will be able to..." value={u.courseOutcome} onChange={e => {const units=[...(formData.units||[])]; units[i].courseOutcome=e.target.value; setFormData({...formData, units})}} />
                        </div>
                     </CardContent>
                   </Card>
                 ))}
                 {!isReadOnly && (
                   <Button variant="outline" className="w-full border-dashed" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(), title:'', content:'', hours:0, courseOutcome:''}]}))}>
                     <Plus className="w-4 h-4 mr-2" /> Add Unit
                   </Button>
                 )}
              </TabsContent>
              <TabsContent value="resources" className="space-y-8">
                 <ResourceSection 
                    title="Standard Text Books" 
                    items={formData.textBooks||[]} 
                    onUpdate={(idx, v) => {const a=[...formData.textBooks!]; a[idx]=v; setFormData({...formData, textBooks:a})}} 
                    onAdd={() => setFormData({...formData, textBooks:[...(formData.textBooks||[]), '']})} 
                    onRemove={(idx) => setFormData({...formData, textBooks: formData.textBooks?.filter((_, i) => i !== idx)})}
                    disabled={isReadOnly}
                 />
                 <ResourceSection 
                    title="Reference Books & Material" 
                    items={formData.referenceBooks||[]} 
                    onUpdate={(idx, v) => {const a=[...formData.referenceBooks!]; a[idx]=v; setFormData({...formData, referenceBooks:a})}} 
                    onAdd={() => setFormData({...formData, referenceBooks:[...(formData.referenceBooks||[]), '']})} 
                    onRemove={(idx) => setFormData({...formData, referenceBooks: formData.referenceBooks?.filter((_, i) => i !== idx)})}
                    disabled={isReadOnly}
                 />
                 <ResourceSection 
                    title="NPTEL / SWAYAM Courses" 
                    items={formData.nptelLinks||[]} 
                    onUpdate={(idx, v) => {const a=[...formData.nptelLinks!]; a[idx]=v; setFormData({...formData, nptelLinks:a})}} 
                    onAdd={() => setFormData({...formData, nptelLinks:[...(formData.nptelLinks||[]), '']})} 
                    onRemove={(idx) => setFormData({...formData, nptelLinks: formData.nptelLinks?.filter((_, i) => i !== idx)})}
                    disabled={isReadOnly}
                    disableAdd // Disabled per institutional requirement
                 />
              </TabsContent>
              <TabsContent value="mapping">
                 <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                    <Table>
                       <TableHeader className="bg-muted/50">
                          <TableRow>
                             <TableHead className="w-20">CO</TableHead>
                             {PO_DEFINITIONS.map(po => <TableHead key={po.code} className="text-center font-mono text-[10px]">{po.code}</TableHead>)}
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {formData.units?.map((u, ui) => (
                             <TableRow key={u.id}>
                                <TableCell className="font-bold">CO{ui+1}</TableCell>
                                {PO_DEFINITIONS.map(po => (
                                   <TableCell key={po.code} className="p-1">
                                      <Select 
                                         disabled={isReadOnly}
                                         value={formData.poMappings?.[u.id]?.[po.code] || '-'} 
                                         onValueChange={v => {
                                            const m={...(formData.poMappings||{})}; 
                                            if(!m[u.id])m[u.id]={}; 
                                            m[u.id][po.code]=v as any; 
                                            setFormData({...formData, poMappings:m})
                                         }}
                                      >
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
                 <div className="mt-4 p-4 bg-muted/30 rounded-lg text-[10px] text-muted-foreground grid grid-cols-4 gap-4">
                    <p><b>1:</b> Low correlation</p>
                    <p><b>2:</b> Medium correlation</p>
                    <p><b>3:</b> High correlation</p>
                    <p><b>-:</b> No correlation</p>
                 </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 border-t bg-background shrink-0">
           <Button variant="outline" onClick={() => onOpenChange(false)}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
           {!isReadOnly && <Button onClick={() => { onSave(formData); onOpenChange(false); }}>Save Course Specification</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceSection({ title, items, onAdd, onUpdate, onRemove, disabled, disableAdd }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-primary">{title}</h4>
        {!disabled && !disableAdd && <Button variant="ghost" size="sm" onClick={onAdd} className="h-7"><Plus className="w-3.5 h-3.5 mr-1" /> Add Item</Button>}
      </div>
      <div className="space-y-2">
         {items.map((it: string, i: number) => (
            <div key={i} className="flex gap-2">
               <Input value={it} onChange={e => onUpdate(i, e.target.value)} disabled={disabled} className="text-sm" />
               {!disabled && <Button variant="ghost" size="icon" onClick={() => onRemove(i)} className="text-red-400 hover:text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></Button>}
            </div>
         ))}
         {items.length === 0 && <p className="text-xs text-muted-foreground italic py-2">No resources listed yet.</p>}
      </div>
    </div>
  );
}
