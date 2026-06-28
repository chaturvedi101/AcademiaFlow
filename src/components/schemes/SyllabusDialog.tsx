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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen, Globe, Link2, Loader2, Plus, Trash2, Search, Layers, AlertTriangle, Book, Video, ExternalLink, Sparkles, Clock, ListPlus, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Syllabus, CorrelationLevel as CorrelationLevelType, CreditRules, CreditCategory, SyllabusUnit } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc, collectionGroup } from "firebase/firestore";
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

const DEFAULT_DSE_GROUPS = ["Elective-I", "Elective-II", "Elective-III", "Elective-IV"];
const DEFAULT_OFE_GROUPS = ["Open Elective-I", "Open Elective-II"];

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
  batchYear?: string;
}

export function SyllabusDialog({ 
  open, 
  onOpenChange, 
  syllabus, 
  existingSyllabi = [],
  onSave,
  branchName,
  canEdit = true,
  canDelete = true,
  currentSchemeId,
  batchYear,
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<any>(userDocRef);

  const [isPoolSearching, setIsPoolSearching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [poolResults, setPoolResults] = useState<Syllabus[]>([]);
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [codeWarning, setCodeWarning] = useState<string | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);

  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: []
  });

  const generateAutoCode = useCallback(() => {
    if (!branchName) return '';
    let prefix = 'GN';
    const cat = formData.creditCategory || '';
    if (cat === 'AEC') prefix = 'AE';
    else if (cat === 'MDC') prefix = 'MD';
    else if (cat === 'VAC') prefix = 'VA';
    else prefix = branchName.substring(0, 2).toUpperCase();

    let ped = formData.type === 'Lab/Sessional' ? 'P' : 'L';
    if (cat === 'PRJ') ped = 'I';
    const pillar = ['DSE', 'OFE'].includes(cat) ? 'E' : 'C';
    const year = Math.ceil((formData.semester || 1) / 2);
    
    let seq = 1;
    if (cat === 'SEC') seq = 40;
    if (['DSE', 'OFE'].includes(cat)) seq = 50;
    if (cat === 'PRJ') seq = 95;

    return `${prefix}${ped}${pillar}${year}${String(seq).padStart(2, '0')}`;
  }, [branchName, formData.type, formData.semester, formData.creditCategory]);

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ ...formData, ...syllabus });
      setCodeWarning(null);
    }
  }, [open, syllabus]);

  useEffect(() => {
    if (open && !syllabus?.id && !formData.subjectCode) {
      setFormData(prev => ({ ...prev, subjectCode: generateAutoCode() }));
    }
  }, [formData.type, formData.semester, formData.creditCategory, open, syllabus?.id]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    // AICTE Exception: 3 hrs = 2 cr
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
          setCodeWarning(`Institutional Code Detected: This code is registered to "${data.title}" elsewhere.`);
          // If it's a new subject/slot, we can auto-fill once
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
  }, [formData.subjectCode]);

  const handleAISyllabus = async () => {
    if (!formData.title) return toast({ title: "Title Required", variant: "destructive" });
    setIsGenerating(true);
    try {
      const res = await generateSyllabusContent({ title: formData.title, unitCount: 5 });
      setFormData(p => ({ ...p, units: res.units as any, textBooks: res.suggestedTextBooks, referenceBooks: res.suggestedReferences }));
      toast({ title: "AI Generated" });
    } catch (e) { toast({ variant: "destructive", title: "AI Failed" }); } finally { setIsGenerating(false); }
  };

  const isReadOnly = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between">
            <div className="flex items-center gap-3"><BookOpen className="w-6 h-6 text-primary" /> {isReadOnly ? 'Specification' : 'Configure Course'}</div>
            {!isReadOnly && <Button size="sm" onClick={handleAISyllabus} disabled={isGenerating}>{isGenerating ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4 mr-2" />} GenAI Architect</Button>}
          </DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8">
            {codeWarning && <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl flex gap-3 text-sm"><AlertTriangle className="w-5 h-5 shrink-0" /><div><p className="font-bold">Divergence Warning</p><p className="text-xs">{codeWarning}</p></div></div>}
            <Tabs defaultValue="basic">
              <TabsList className="grid w-full grid-cols-4 mb-8"><TabsTrigger value="basic">Identity</TabsTrigger><TabsTrigger value="syllabus">Content</TabsTrigger><TabsTrigger value="resources">Resources</TabsTrigger><TabsTrigger value="mapping">Outcomes</TabsTrigger></TabsList>
              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2"><Label>Category</Label><Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['DSC','DSE','OFE','VAC','AEC','SEC','MDC','PRJ'].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Title</Label><Input disabled={isReadOnly} value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Code</Label><div className="relative"><Input disabled={isReadOnly} value={formData.subjectCode} onChange={e => setFormData({...formData, subjectCode: e.target.value.toUpperCase()})} />{isCheckingUniqueness && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin" />}</div></div>
                  <div className="space-y-2"><Label>Type</Label><Select disabled={isReadOnly} value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Theory">Theory</SelectItem><SelectItem value="Lab/Sessional">Lab/Sessional</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Credits</Label><div className="p-2 bg-primary/5 rounded font-bold text-center">{formData.credits} Cr</div></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="space-y-1"><Label className="text-[10px]">L</Label><Input type="number" disabled={isReadOnly} value={formData.lectureCredits} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} /></div>
                   <div className="space-y-1"><Label className="text-[10px]">T</Label><Input type="number" disabled={isReadOnly} value={formData.tutorialCredits} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} /></div>
                   <div className="space-y-1"><Label className="text-[10px]">P</Label><Input type="number" disabled={isReadOnly} value={formData.practicalCredits} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} /><p className="text-[8px] text-muted-foreground">3H=2Cr Exception Active</p></div>
                </div>
              </TabsContent>
              <TabsContent value="syllabus" className="space-y-6">
                 {formData.units?.map((u, i) => (
                   <Card key={u.id} className="border-muted">
                     <CardHeader className="p-4 bg-muted/20 flex flex-row items-center justify-between"><div className="flex items-center gap-3"><Badge>Unit {i+1}</Badge><span className="font-bold">{u.title}</span></div><div className="flex items-center gap-2"><Clock className="w-4 h-4" /><Input className="w-16 h-8" value={u.hours} onChange={e => {const units=[...(formData.units||[])]; units[i].hours=Number(e.target.value); setFormData({...formData, units})}} /></div></CardHeader>
                     <CardContent className="p-4 space-y-4"><Input placeholder="Unit Title" value={u.title} onChange={e => {const units=[...(formData.units||[])]; units[i].title=e.target.value; setFormData({...formData, units})}} /><Textarea placeholder="Content" value={u.content} onChange={e => {const units=[...(formData.units||[])]; units[i].content=e.target.value; setFormData({...formData, units})}} /></CardContent>
                   </Card>
                 ))}
                 <Button variant="outline" className="w-full" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(), title:'', content:'', hours:0, courseOutcome:''}]}))}><Plus className="w-4 h-4 mr-2" /> Add Unit</Button>
              </TabsContent>
              <TabsContent value="resources" className="space-y-8">
                 <ResourceSection title="Text Books" items={formData.textBooks||[]} onUpdate={(idx, v) => {const a=[...formData.textBooks!]; a[idx]=v; setFormData({...formData, textBooks:a})}} onAdd={() => setFormData({...formData, textBooks:[...(formData.textBooks||[]), '']})} />
                 <ResourceSection title="Reference" items={formData.referenceBooks||[]} onUpdate={(idx, v) => {const a=[...formData.referenceBooks!]; a[idx]=v; setFormData({...formData, referenceBooks:a})}} onAdd={() => setFormData({...formData, referenceBooks:[...(formData.referenceBooks||[]), '']})} />
                 <ResourceSection title="NPTEL / SWAYAM" items={formData.nptelLinks||[]} onUpdate={(idx, v) => {const a=[...formData.nptelLinks!]; a[idx]=v; setFormData({...formData, nptelLinks:a})}} disableAdd />
              </TabsContent>
              <TabsContent value="mapping">
                 <div className="border rounded overflow-hidden"><Table><TableHeader><TableRow><TableHead>Unit</TableHead>{PO_DEFINITIONS.map(po => <TableHead key={po.code}>{po.code}</TableHead>)}</TableRow></TableHeader><TableBody>{formData.units?.map((u, ui) => <TableRow key={u.id}><TableCell>CO{ui+1}</TableCell>{PO_DEFINITIONS.map(po => <TableCell key={po.code} className="p-1"><Select value={formData.poMappings?.[u.id]?.[po.code] || '-'} onValueChange={v => {const m={...(formData.poMappings||{})}; if(!m[u.id])m[u.id]={}; m[u.id][po.code]=v as any; setFormData({...formData, poMappings:m})}}><SelectTrigger className="h-8 w-12"><SelectValue /></SelectTrigger><SelectContent>{['1','2','3','-'].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></TableCell>)}</TableRow>)}</TableBody></Table></div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        <DialogFooter className="p-6 border-t bg-background shrink-0"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={() => { onSave(formData); onOpenChange(false); }}>Save Specification</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceSection({ title, items, onAdd, onUpdate, disableAdd }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><h4 className="font-bold text-sm text-primary">{title}</h4>{!disableAdd && <Button variant="ghost" size="sm" onClick={onAdd}><Plus className="w-3 h-3 mr-1" /> Add</Button>}</div>
      <div className="space-y-2">{items.map((it: string, i: number) => <Input key={i} value={it} onChange={e => onUpdate(i, e.target.value)} />)}</div>
    </div>
  );
}
