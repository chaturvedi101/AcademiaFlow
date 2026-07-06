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
  ShieldCheck, ChevronDown, ChevronUp, Trash2, Lock, CheckCircle2, ShieldAlert, Eye, Sparkles, Wand2, FlaskConical, Download, Layers
} from "lucide-react";
import { Syllabus, CreditRules, UserProfile, CreditCategory, SubjectType, SyllabusUnit, Scheme } from "@/lib/types";
import { useFirestore } from "@/firebase";
import { query, getDocs, collection, where, doc, getDoc } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";

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
  batchYear
}: SyllabusDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
    credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', units: [],
    poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
    timetableSlot: '', electiveGroupId: ''
  });

  const isSuperuser = userProfile?.role === 'admin' || userProfile?.role === 'dean_academic';
  const isCommitteeConvenor = userProfile?.role === 'committee_convenor';
  const isCommonBOS = !!userProfile?.faculty?.includes('(Common BOS)');

  useEffect(() => {
    if (open && syllabus) {
      setFormData({ 
        subjectCode: '', title: '', lectureCredits: 0, tutorialCredits: 0, practicalCredits: 0,
        credits: 0, semester: 1, type: 'Theory', creditCategory: 'DSC', 
        poMappings: {}, textBooks: [], referenceBooks: [], nptelLinks: [], youtubeLinks: [],
        timetableSlot: '', electiveGroupId: '',
        ...syllabus
      });
    }
  }, [open, syllabus]);

  const calculateCredits = (l: number, t: number, p: number) => {
    let total = l + t;
    if (p === 1) total += 0.5;
    else if (p === 2) total += 1;
    else if (p === 3) total += 2;
    else if (p === 4) total += 2;
    else if (p > 4) total += p / 2;
    return Number(total.toFixed(2));
  };

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    setFormData(prev => ({ ...prev, credits: calculateCredits(l, t, p) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

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
      toast({ title: "AI Generation Complete" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "AI Error", description: e.message });
    } finally {
      setIsAiGenerating(false);
    }
  };

  const isAuthorized = isSuperuser || isCommonBOS || isCommitteeConvenor || canEdit;

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
              <Button onClick={handleAiGenerate} disabled={isAiGenerating || !formData.title} variant="outline" className="gap-2">
                {isAiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                AI Content
              </Button>
            </div>
          </DialogTitle>
          <DialogDescription>
            Authorized syllabus management module. Use specialized pools for foundational courses via the Equivalence Manager.
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
                    <Select disabled={!isAuthorized} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Course Title</Label>
                    <Input disabled={!isAuthorized} value={formData.title || ''} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g. Engineering Mathematics-I" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Subject Code</Label>
                    <Input 
                      disabled={!isSuperuser && !isCommonBOS && !isCommitteeConvenor} 
                      value={formData.subjectCode || ''} 
                      onChange={e => setFormData({...formData, subjectCode: e.target.value.toUpperCase()})} 
                      placeholder="e.g. MALT101"
                      className="font-mono font-bold text-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Methodology</Label>
                    <Select disabled={!isAuthorized} value={formData.type || 'Theory'} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory (L-T)</SelectItem>
                        <SelectItem value="Lab/Sessional">Lab (P)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Semester Slot</Label>
                    <Input disabled={!isAuthorized} type="number" value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Total Credits</Label>
                    <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary border border-primary/20">{formData.credits} Cr</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-white border rounded-xl shadow-inner">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">L (Lecture)</Label>
                    <Input type="number" disabled={!isAuthorized} value={formData.lectureCredits || 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">T (Tutorial)</Label>
                    <Input type="number" disabled={!isAuthorized} value={formData.tutorialCredits || 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold">P (Practical Hours)</Label>
                    <Input type="number" disabled={!isAuthorized} value={formData.practicalCredits || 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
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
                          <Badge className="bg-primary/10 text-primary border-none">Unit {i+1}</Badge>
                          <span className="font-bold">{u.title || "Untitled Unit"}</span>
                          {expandedUnits[u.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                     </CardHeader>
                     <CardContent className={cn("p-4 space-y-4", !expandedUnits[u.id] && "hidden")}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2"><Label>Title</Label><Input disabled={!isAuthorized} value={u.title || ''} onChange={e => { const units = [...(formData.units || [])]; units[i].title = e.target.value; setFormData({ ...formData, units }); }} /></div>
                           <div className="space-y-2"><Label>Hours</Label><Input type="number" disabled={!isAuthorized} value={u.hours || 0} onChange={e => { const units = [...(formData.units || [])]; units[i].hours = Number(e.target.value); setFormData({ ...formData, units }); }} /></div>
                        </div>
                        <div className="space-y-2">
                          <Label>Syllabus Content</Label>
                          <Textarea disabled={!isAuthorized} value={u.content || ''} onChange={e => { const units = [...(formData.units || [])]; units[i].content = e.target.value; setFormData({ ...formData, units }); }} className="min-h-[120px]" />
                        </div>
                        <div className="space-y-2">
                          <Label>Unit Learning Outcome</Label>
                          <Input disabled={!isAuthorized} value={u.courseOutcome || ''} onChange={e => { const units = [...(formData.units || [])]; units[i].courseOutcome = e.target.value; setFormData({ ...formData, units }); }} placeholder="The student will be able to..." />
                        </div>
                     </CardContent>
                   </Card>
                 ))}
                 {isAuthorized && (
                   <Button variant="outline" className="w-full border-dashed h-12" onClick={() => setFormData(p => ({...p, units: [...(p.units||[]), {id:Math.random().toString(36).substr(2,9), title:'', content:'', hours:0, courseOutcome:''}]}))}>
                     <Plus className="w-4 h-4 mr-2" /> Add Course Unit
                   </Button>
                 )}
              </TabsContent>

              <TabsContent value="resources" className="space-y-8">
                 <div className="space-y-4">
                    <Label className="font-bold text-primary flex items-center gap-2">
                      <BookOpen className="w-4 h-4" /> Reference Text Books
                    </Label>
                    {formData.textBooks?.map((it, i) => (
                      <div key={i} className="flex gap-2">
                        <Input value={it} disabled={!isAuthorized} onChange={e => { const a=[...formData.textBooks!]; a[i]=e.target.value; setFormData({...formData, textBooks:a}) }} placeholder="Author, Title, Edition, Publisher" />
                        {isAuthorized && <Button variant="ghost" size="icon" onClick={() => setFormData({...formData, textBooks: formData.textBooks?.filter((_, idx) => idx !== i)})}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
                      </div>
                    ))}
                    {isAuthorized && <Button variant="ghost" size="sm" onClick={() => setFormData({...formData, textBooks: [...(formData.textBooks||[]), '']})} className="text-primary"><Plus className="w-3.5 h-3.5 mr-1" /> Add Reference</Button>}
                 </div>
              </TabsContent>

              <TabsContent value="mapping" className="p-8 text-center text-muted-foreground italic bg-white rounded-xl border border-dashed">
                 <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                 <p>Advanced Outcome Mapping (PO/PSO) is under systematic implementation.</p>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
        
        <DialogFooter className="p-6 border-t bg-background shrink-0 shadow-lg">
           <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-6">Cancel</Button>
           <Button onClick={() => { onSave(formData); onOpenChange(false); }} className="h-11 px-8 shadow-md">Save Subject Specification</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
