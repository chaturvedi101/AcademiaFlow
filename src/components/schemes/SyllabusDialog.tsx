
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
  ShieldCheck, ChevronDown, ChevronUp, Trash2, Lock
} from "lucide-react";
import { Syllabus, CreditRules, UserProfile, CreditCategory, SubjectType } from "@/lib/types";
import { useFirestore } from "@/firebase";
import { query, getDocs, collectionGroup, where } from "firebase/firestore";
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
  onSave,
  canEdit = true,
  currentSchemeId,
  userProfile,
  existingSyllabi = []
}: SyllabusDialogProps) {
  const db = useFirestore();

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
      const initialExpanded: Record<string, boolean> = {};
      syllabus.units?.forEach(u => initialExpanded[u.id] = true);
      setExpandedUnits(initialExpanded);
    }
  }, [open, syllabus]);

  // Sync credits and hours visibility
  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    
    // RTU Credit Calculation Logic: L+T + Practical specific rules
    let creditTotal = l + t;
    if (p === 1) creditTotal += 0.5;
    else if (p === 2) creditTotal += 1;
    else if (p === 3) creditTotal += 2;
    else if (p === 4) creditTotal += 2;
    else if (p > 4) creditTotal += p / 2;
    
    setFormData(prev => ({ ...prev, credits: Number(creditTotal.toFixed(2)) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits, formData.type]);

  // Auto-Code Generation Logic
  useEffect(() => {
    if (!open || !formData.creditCategory || !formData.semester) return;
    
    // Do not auto-generate if we are editing an existing non-slot course
    if (formData.id && !formData.isSlot) return;

    const generateCode = () => {
      // 1. Prefix determination
      let prefix = 'GN'; 
      const cat = formData.creditCategory;
      if (cat === 'AEC') prefix = 'AE';
      else if (cat === 'MDC') prefix = 'MD';
      else if (cat === 'VAC') prefix = 'VA';
      else {
        // Try to derive from current program context or use placeholders
        prefix = 'CS'; // Default for testing, would normally use scheme/program data
      }

      // 2. Pedagogy determination
      let pedagogy = 'L';
      if (cat === 'PRJ') pedagogy = 'I';
      else if (formData.type === 'Lab/Sessional') pedagogy = 'P';

      // 3. Pillar determination
      const pillar = ['DSE', 'OFE', 'VAC', 'MDC', 'AEC'].includes(cat!) ? 'E' : 'C';

      // 4. Year determination
      const year = Math.ceil((formData.semester || 1) / 2);

      // 5. Sequence determination
      const typeKey = `${cat}-${year}`;
      const sameType = existingSyllabi.filter(s => 
        s.creditCategory === cat && 
        Math.ceil(s.semester / 2) === year
      );
      const seq = String(sameType.length + 1).padStart(2, '0');

      return `${prefix}${pedagogy}${pillar}${year}${seq}`;
    };

    const newCode = generateCode();
    if (newCode !== formData.subjectCode) {
      setFormData(prev => ({ ...prev, subjectCode: newCode }));
    }
  }, [formData.creditCategory, formData.type, formData.semester, open, existingSyllabi]);

  const isAdminOrDeanAcad = userProfile?.role === 'admin' || userProfile?.role === 'dean_academic';

  const isAuthorized = useMemo(() => {
    if (!userProfile || userProfile.role === 'monitor') return false; 
    
    const isInstitutional = ['AEC', 'VAC', 'MDC'].includes(formData.creditCategory || '');
    const isCommonBOS = userProfile.faculty === 'University-wide (Common BOS)';
    
    // Institutional categories are ONLY managed by Common BOS or high leadership
    if (isInstitutional) {
      return isAdminOrDeanAcad || isCommonBOS;
    }
    
    // Other categories are managed by Branch BOS (Convenor/Member)
    // Here we assume canEdit is passed based on branch assignment logic in parent
    return canEdit;
  }, [userProfile, formData.creditCategory, canEdit, isAdminOrDeanAcad]);

  const isReadOnly = !isAuthorized;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
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
          </DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'University standard definition. Editing restricted.' : 'Configure institutional course identity and academic content.'}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                      Subject Code 
                      {!isAdminOrDeanAcad && <Lock className="w-3 h-3 text-amber-600" />}
                    </Label>
                    <div className="relative">
                      <Input 
                        disabled={!isAdminOrDeanAcad} 
                        value={formData.subjectCode || ''} 
                        onChange={e => setFormData({...formData, subjectCode: e.target.value.toUpperCase()})}
                        className={cn(!isAdminOrDeanAcad && "bg-muted/50 cursor-not-allowed font-bold text-primary")}
                      />
                      {isCheckingUniqueness && <Loader2 className="absolute right-3 top-3 w-4 h-4 animate-spin opacity-50" />}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Methodology</Label>
                    <Select disabled={isReadOnly} value={formData.type || 'Theory'} onValueChange={(v: SubjectType) => setFormData({...formData, type: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory (L-T)</SelectItem>
                        <SelectItem value="Lab/Sessional">Lab/Sessional (P)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Total Credits</Label>
                    <div className="p-2 bg-primary/5 rounded font-bold text-center h-10 flex items-center justify-center text-primary border border-primary/20">
                      {formData.credits || 0} Cr
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border rounded-xl shadow-sm">
                    {formData.type === 'Theory' ? (
                      <>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">L (Lecture)</Label>
                          <Input type="number" disabled={isReadOnly} value={formData.lectureCredits || 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">T (Tutorial)</Label>
                          <Input type="number" disabled={isReadOnly} value={formData.tutorialCredits || 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[10px] uppercase font-bold text-muted-foreground">P (Practical/Sessional)</Label>
                        <Input type="number" disabled={isReadOnly} value={formData.practicalCredits || 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Slot</Label>
                      <Input disabled={isReadOnly} value={formData.timetableSlot || ''} onChange={e => setFormData({...formData, timetableSlot: e.target.value.toUpperCase()})} placeholder="1 or A" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase font-bold text-muted-foreground">Semester</Label>
                      <Input type="number" disabled={isReadOnly} value={formData.semester || 1} onChange={e => setFormData({...formData, semester: Number(e.target.value)})} />
                    </div>
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
                 <div className="border rounded-xl overflow-hidden bg-white">
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
           {!isReadOnly && <Button onClick={() => { onSave(formData); onOpenChange(false); }}>Save Course Specification</Button>}
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
