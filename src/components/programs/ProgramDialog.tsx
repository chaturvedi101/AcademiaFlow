"use client";

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Program, CreditRules, FACULTIES, UserProfile, ProgramSlotTemplate, CreditCategory, SubjectType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { X, Plus, Trash2, Layers, ShieldCheck as ShieldIcon } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface ProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: Program;
  userProfile?: UserProfile;
}

const DEFAULT_RULES: CreditRules = {
  dscMin: 64,
  dscMax: 88,
  experientialMin: 8,
  experientialMax: 12,
  dseMin: 8,
  dseMax: 16,
  ofeMin: 12,
  ofeMax: 24,
  electiveMin: 24,
  electiveMax: 32,
  projectMin: 16,
  projectMax: 32,
  vacTotal: 8,
  aecTotal: 8,
  secTotal: 8,
  mdcTotal: 8,
  totalRequired: 160
};

const ALL_CATEGORIES: CreditCategory[] = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'];

export function ProgramDialog({ open, onOpenChange, program, userProfile }: ProgramDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [newBranch, setNewBranch] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  
  const initialFaculty = userProfile?.role === 'dean_faculty' ? userProfile.faculty : FACULTIES[0];
  const isCommonBos = userProfile?.faculty === 'University-wide (Common BOS)';
  const isGlobalAdmin = userProfile?.role === 'admin' || userProfile?.role === 'dean_academic';

  const visibleCategories = useMemo(() => {
    if (isGlobalAdmin) return ALL_CATEGORIES;
    if (isCommonBos) return ['VAC', 'MDC', 'AEC', 'OFE'] as CreditCategory[];
    return ['DSC', 'DSE', 'SEC', 'PRJ', 'OFE'] as CreditCategory[];
  }, [isGlobalAdmin, isCommonBos]);

  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    code: '',
    faculty: initialFaculty,
    description: '',
    level: 'UG',
    totalSemesters: 8,
    branches: [],
    branchPrefixes: {},
    rules: { ...DEFAULT_RULES },
    slotTemplate: []
  });

  useEffect(() => {
    if (program) {
      setFormData({
        ...program,
        branches: program.branches || [],
        branchPrefixes: program.branchPrefixes || {},
        rules: { ...DEFAULT_RULES, ...(program.rules || {}) },
        slotTemplate: (program.slotTemplate || []).map(s => ({
          ...s,
          lectureCredits: s.lectureCredits ?? 0,
          tutorialCredits: s.tutorialCredits ?? 0,
          practicalCredits: s.practicalCredits ?? 0,
          electiveGroupId: s.electiveGroupId || ''
        }))
      });
    } else {
      setFormData({
        name: '',
        code: '',
        faculty: initialFaculty,
        description: '',
        level: 'UG',
        totalSemesters: 8,
        branches: [],
        branchPrefixes: {},
        rules: { ...DEFAULT_RULES },
        slotTemplate: []
      });
    }
  }, [program, open, initialFaculty]);

  const calculateCredits = (l: number, t: number, p: number) => {
    let total = l + t;
    if (p === 1) total += 0.5;
    else if (p === 2) total += 1;
    else if (p === 3) total += 2;
    else if (p === 4) total += 2;
    else if (p > 4) total += p / 2;
    return Number(total.toFixed(2));
  };

  const getPillar = (cat: CreditCategory) => {
    switch(cat) {
      case 'DSC': return 'C';
      case 'DSE': return 'E';
      case 'OFE': return 'E';
      case 'SEC': return 'S';
      case 'VAC': return 'V';
      case 'AEC': return 'A';
      case 'MDC': return 'M';
      case 'PRJ': return 'P';
      default: return 'C';
    }
  };

  const generateTemplateCode = (slot: Partial<ProgramSlotTemplate>) => {
    const p = slot.type === 'Lab/Sessional' ? 'P' : (slot.creditCategory === 'PRJ' ? 'I' : 'L');
    const pillar = getPillar(slot.creditCategory || 'DSC');
    const year = Math.ceil((slot.semester || 1) / 2);
    return `XX${p}${pillar}${year}XX`;
  };

  const handleSave = () => {
    if (isCommonBos) return;

    if (!formData.code || !formData.faculty) {
      toast({ title: "Validation Error", description: "Program code and Faculty are required.", variant: "destructive" });
      return;
    }

    const programId = program?.id || formData.code.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substr(2, 9);
    const programRef = doc(db, 'programs', programId);
    
    const data = {
      ...formData,
      totalSemesters: Number(formData.totalSemesters || 8),
      updatedAt: serverTimestamp(),
      createdAt: program?.createdAt || serverTimestamp(),
      slotTemplate: formData.slotTemplate || []
    };

    setDoc(programRef, data, { merge: true })
      .then(() => {
        toast({ title: "Success", description: "Program saved successfully." });
        onOpenChange(false);
      })
      .catch((err) => {
        const permissionError = new FirestorePermissionError({
          path: programRef.path,
          operation: 'write',
          requestResourceData: data,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const updateRule = (key: keyof CreditRules, value: string) => {
    if (isCommonBos) return;
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      rules: {
        ...(prev.rules || DEFAULT_RULES),
        [key]: numValue
      }
    }));
  };

  const addBranch = () => {
    if (isCommonBos || !newBranch.trim()) return;
    if (formData.branches?.includes(newBranch.trim())) return;
    
    const branchName = newBranch.trim();
    setFormData(prev => ({
      ...prev,
      branches: [...(prev.branches || []), branchName],
      branchPrefixes: {
        ...(prev.branchPrefixes || {}),
        [branchName]: newPrefix.trim() || branchName.substring(0, 2).toUpperCase()
      }
    }));
    setNewBranch('');
    setNewPrefix('');
  };

  const removeBranch = (branch: string) => {
    if (isCommonBos) return;
    const newPrefixes = { ...(formData.branchPrefixes || {}) };
    delete newPrefixes[branch];
    
    setFormData(prev => ({
      ...prev,
      branches: prev.branches?.filter(b => b !== branch),
      branchPrefixes: newPrefixes
    }));
  };

  const addTemplateSlot = (semester: number) => {
    const newSlot: ProgramSlotTemplate = {
      id: Math.random().toString(36).substr(2, 9),
      semester,
      creditCategory: 'DSC',
      credits: 4,
      type: 'Theory',
      lectureCredits: 3,
      tutorialCredits: 1,
      practicalCredits: 0,
      subjectCode: '',
      title: '',
      electiveGroupId: ''
    };
    newSlot.subjectCode = generateTemplateCode(newSlot);
    setFormData(prev => ({
      ...prev,
      slotTemplate: [...(prev.slotTemplate || []), newSlot]
    }));
  };

  const updateTemplateSlot = (id: string, updates: Partial<ProgramSlotTemplate>) => {
    setFormData(prev => {
      const newTemplate = prev.slotTemplate?.map(s => {
        if (s.id === id) {
          let updated = { ...s, ...updates };
          
          if (updates.type === 'Theory') {
            updated.practicalCredits = 0;
          } else if (updates.type === 'Lab/Sessional') {
            updated.lectureCredits = 0;
            updated.tutorialCredits = 0;
          }
          
          const l = Number(updated.lectureCredits) || 0;
          const t = Number(updated.tutorialCredits) || 0;
          const p = Number(updated.practicalCredits) || 0;
          updated.credits = calculateCredits(l, t, p);
          updated.subjectCode = generateTemplateCode(updated);
          
          return updated;
        }
        return s;
      });
      return { ...prev, slotTemplate: newTemplate };
    });
  };

  const removeTemplateSlot = (id: string) => {
    setFormData(prev => ({
      ...prev,
      slotTemplate: prev.slotTemplate?.filter(s => s.id !== id)
    }));
  };

  const isAuthorized = isGlobalAdmin || (userProfile?.role === 'dean_faculty' && userProfile.faculty === program?.faculty);
  const isReadOnly = !isAuthorized;
  const isFacultyDisabled = userProfile?.role === 'dean_faculty' || isReadOnly;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-20">
          <DialogTitle className="font-headline text-2xl flex items-center gap-3">
            {program ? 'Program Specification' : 'New Program Framework'}
            {isReadOnly && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 uppercase text-[10px] font-black">Institutional Lock</Badge>}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly 
              ? 'Authorized institutional framework. Editing restricted to program owners.'
              : 'Configure master templates and credit boundaries for institutional consistency.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b">
            <TabsList className="bg-transparent border-none gap-6 h-12">
              <TabsTrigger value="basic" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Identity</TabsTrigger>
              <TabsTrigger value="branches" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Jurisdiction</TabsTrigger>
              <TabsTrigger value="rules" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Audit Rules</TabsTrigger>
              <TabsTrigger value="template" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none">Master Patterns</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 w-full min-h-0">
            <div className="p-6 space-y-8 pb-12">
              <TabsContent value="basic" className="mt-0 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Institutional Name</Label>
                    <Input 
                      disabled={isReadOnly}
                      placeholder="e.g. B.Tech in Materials Engineering" 
                      value={formData.name || ''}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Assigned Faculty</Label>
                    <Select 
                      value={formData.faculty} 
                      onValueChange={(v: any) => setFormData({ ...formData, faculty: v })}
                      disabled={isFacultyDisabled}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FACULTIES.map(faculty => (
                          <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Framework Code</Label>
                    <Input disabled={isReadOnly} placeholder="BTECH-MT" value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Academic Tier</Label>
                    <Select disabled={isReadOnly} value={formData.level || 'UG'} onValueChange={(v: any) => setFormData({ ...formData, level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UG">Undergraduate (UG)</SelectItem>
                        <SelectItem value="PG">Postgraduate (PG)</SelectItem>
                        <SelectItem value="Diploma">Diploma</SelectItem>
                        <SelectItem value="Certificate">Certificate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Degree Objectives</Label>
                  <Textarea disabled={isReadOnly} placeholder="Official program description..." value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} className="min-h-[100px]" />
                </div>
                <div className="space-y-2 max-w-[200px]">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Total Semesters</Label>
                  <Input disabled={isReadOnly} type="number" value={formData.totalSemesters ?? 8} onChange={e => setFormData({ ...formData, totalSemesters: parseInt(e.target.value) || 8 })} />
                </div>
              </TabsContent>

              <TabsContent value="branches" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <Label className="text-sm font-bold flex items-center gap-2"><Layers className="w-4 h-4 text-primary" /> Branch Registry</Label>
                  {!isReadOnly && (
                    <div className="flex gap-2 items-end p-4 bg-muted/20 rounded-xl border border-dashed">
                      <div className="grid gap-1.5 flex-1">
                        <Label className="text-[10px] uppercase">New Specialization</Label>
                        <Input placeholder="Branch Name" value={newBranch} onChange={e => setNewBranch(e.target.value)} />
                      </div>
                      <div className="grid gap-1.5 w-32">
                        <Label className="text-[10px] uppercase">Branch Code</Label>
                        <Input placeholder="MT" value={newPrefix} onChange={e => setNewPrefix(e.target.value.toUpperCase())} maxLength={2} />
                      </div>
                      <Button type="button" onClick={addBranch} variant="secondary">Authorize Branch</Button>
                    </div>
                  )}
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="pl-6">Branch / Specialization</TableHead>
                          <TableHead className="w-48">System Prefix</TableHead>
                          {!isReadOnly && <TableHead className="w-16 pr-6"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.branches?.map(branch => (
                          <TableRow key={branch}>
                            <TableCell className="pl-6 font-medium">{branch}</TableCell>
                            <TableCell className="font-mono font-bold text-primary">{formData.branchPrefixes?.[branch]}</TableCell>
                            {!isReadOnly && <TableCell className="pr-6 text-right"><Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeBranch(branch)}><Trash2 className="w-4 h-4" /></Button></TableCell>}
                          </TableRow>
                        ))}
                        {(!formData.branches || formData.branches.length === 0) && (
                          <TableRow><TableCell colSpan={3} className="text-center py-12 text-muted-foreground italic">No branches defined for this framework.</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="rules" className="mt-0 space-y-8">
                <div className="space-y-6">
                  <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 flex items-center gap-3 text-accent text-sm">
                    <ShieldIcon className="w-5 h-5 shrink-0" />
                    <p>Audit parameters defining degree boundaries. These rules are inherited by the Credit Validator in every scheme.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-l-4 border-primary pl-3">Core & Project Audits</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">DSC Min</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.dscMin ?? ''} onChange={e => updateRule('dscMin', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">DSC Max</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.dscMax ?? ''} onChange={e => updateRule('dscMax', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">PRJ Min</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.projectMin ?? ''} onChange={e => updateRule('projectMin', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">PRJ Max</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.projectMax ?? ''} onChange={e => updateRule('projectMax', e.target.value)} /></div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-l-4 border-primary pl-3">Elective Pool Bounds</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">DSE Min</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.dseMin ?? ''} onChange={e => updateRule('dseMin', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">DSE Max</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.dseMax ?? ''} onChange={e => updateRule('dseMax', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">OFE Min</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.ofeMin ?? ''} onChange={e => updateRule('ofeMin', e.target.value)} /></div>
                        <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">OFE Max</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.ofeMax ?? ''} onChange={e => updateRule('ofeMax', e.target.value)} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="font-bold text-xs uppercase tracking-wider text-primary border-l-4 border-primary pl-3">Institutional Credit Targets (Fixed)</h3>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">VAC (Value)</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.vacTotal ?? ''} onChange={e => updateRule('vacTotal', e.target.value)} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">AEC (Ability)</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.aecTotal ?? ''} onChange={e => updateRule('aecTotal', e.target.value)} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">SEC (Skill)</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.secTotal ?? ''} onChange={e => updateRule('secTotal', e.target.value)} /></div>
                      <div className="space-y-1.5"><Label className="text-[10px] uppercase font-bold">MDC (Multi)</Label><Input disabled={isReadOnly} type="number" value={formData.rules?.mdcTotal ?? ''} onChange={e => updateRule('mdcTotal', e.target.value)} /></div>
                    </div>
                  </div>

                  <div className="pt-8">
                    <div className="flex items-center justify-between p-8 bg-primary/5 rounded-2xl border-2 border-primary/20 shadow-inner">
                      <div className="space-y-1.5">
                        <Label className="text-xl font-headline font-bold text-primary">Degree Graduation Total</Label>
                        <p className="text-sm text-muted-foreground">The exact total required for university accreditation.</p>
                      </div>
                      <div className="w-48">
                        <Input 
                          disabled={isReadOnly} 
                          type="number" 
                          className="text-3xl h-16 text-center font-black border-primary/30 bg-white" 
                          value={formData.rules?.totalRequired ?? 160} 
                          onChange={e => updateRule('totalRequired', e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="template" className="mt-0 space-y-6">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex items-center gap-3 text-primary text-sm mb-6">
                  <Layers className="w-5 h-5 shrink-0" />
                  <p><b>Master Slot Patterns:</b> These slots are inherited by every branch scheme. Subjects will follow the <code>XX</code> pattern, which is auto-resolved to branch codes during instantiation.</p>
                </div>
                <div className="space-y-10">
                  {Array.from({ length: formData.totalSemesters || 8 }, (_, i) => i + 1).map(sem => {
                    const slots = formData.slotTemplate?.filter(s => s.semester === sem) || [];
                    return (
                      <div key={sem} className="border rounded-2xl p-6 bg-muted/10">
                        <div className="flex items-center justify-between mb-6">
                          <h4 className="font-headline font-bold text-lg flex items-center gap-2">
                             <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center font-bold">{sem}</Badge>
                             Semester Patterns
                          </h4>
                          {!isReadOnly && <Button variant="outline" size="sm" onClick={() => addTemplateSlot(sem)} className="h-9 gap-2 shadow-sm"><Plus className="w-4 h-4" /> Define Slot</Button>}
                        </div>
                        <div className="space-y-6">
                          {slots.map(slot => (
                            <div key={slot.id} className="grid grid-cols-12 gap-3 items-end border-b border-border/50 pb-6 last:border-0 last:pb-0 group">
                              <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Pool Category</Label>
                                <Select disabled={isReadOnly} value={slot.creditCategory} onValueChange={(v: CreditCategory) => updateTemplateSlot(slot.id, { creditCategory: v })}>
                                  <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>{visibleCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Methodology</Label>
                                <Select disabled={isReadOnly} value={slot.type} onValueChange={(v: SubjectType) => updateTemplateSlot(slot.id, { 
                                  type: v,
                                  practicalCredits: v === 'Theory' ? 0 : slot.practicalCredits,
                                  lectureCredits: v === 'Lab/Sessional' ? 0 : slot.lectureCredits,
                                  tutorialCredits: v === 'Lab/Sessional' ? 0 : slot.tutorialCredits
                                })}>
                                  <SelectTrigger className="h-10 bg-white"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Theory">Theory (L-T)</SelectItem>
                                    <SelectItem value="Lab/Sessional">Lab (P)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {slot.type === 'Theory' ? (
                                <>
                                  <div className="col-span-1 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold">L</Label>
                                    <Input disabled={isReadOnly} type="number" value={slot.lectureCredits} onChange={e => updateTemplateSlot(slot.id, { lectureCredits: Number(e.target.value) })} className="h-10 text-center bg-white" />
                                  </div>
                                  <div className="col-span-1 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold">T</Label>
                                    <Input disabled={isReadOnly} type="number" value={slot.tutorialCredits} onChange={e => updateTemplateSlot(slot.id, { tutorialCredits: Number(e.target.value) })} className="h-10 text-center bg-white" />
                                  </div>
                                </>
                              ) : (
                                <div className="col-span-2 space-y-1">
                                  <Label className="text-[10px] uppercase font-bold">P (Lab Hours)</Label>
                                  <Input disabled={isReadOnly} type="number" value={slot.practicalCredits} onChange={e => updateTemplateSlot(slot.id, { practicalCredits: Number(e.target.value) })} className="h-10 text-center bg-white" />
                                </div>
                              )}

                              <div className="col-span-1 space-y-1">
                                <Label className="text-[10px] uppercase font-bold">Cr</Label>
                                <div className="h-10 flex items-center justify-center bg-primary/5 rounded-lg border border-primary/20 text-xs font-black text-primary">
                                  {slot.credits}
                                </div>
                              </div>
                              
                              <div className="col-span-1 space-y-1">
                                <Label className="text-[10px] uppercase font-bold">Pattern</Label>
                                <div className="h-10 flex items-center justify-center bg-muted/50 rounded-lg border font-mono text-[9px] font-bold text-muted-foreground uppercase px-2">
                                  {slot.subjectCode || '??'}
                                </div>
                              </div>

                              <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase font-bold">Elective Group ID</Label>
                                <Input disabled={isReadOnly} placeholder="e.g. Elective-I" value={slot.electiveGroupId || ''} onChange={e => updateTemplateSlot(slot.id, { electiveGroupId: e.target.value })} className="h-10 bg-white" />
                              </div>

                              <div className="col-span-2 space-y-1">
                                <Label className="text-[10px] uppercase font-bold">Descriptive Title</Label>
                                <Input disabled={isReadOnly} value={slot.title || ''} onChange={e => updateTemplateSlot(slot.id, { title: e.target.value })} className="h-10 bg-white" placeholder="e.g. Core Course III" />
                              </div>

                              {!isReadOnly && (
                                <div className="col-span-1 pb-0.5">
                                  <Button variant="ghost" size="icon" className="h-10 w-10 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => removeTemplateSlot(slot.id)}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                          {slots.length === 0 && (
                            <div className="py-8 text-center text-muted-foreground text-xs italic bg-white/50 rounded-xl border border-dashed">
                              No patterns defined for Semester {sem}. Click "Define Slot" to begin.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>
            </div>
          </ScrollArea>
        </Tabs>
        <DialogFooter className="p-6 bg-muted/20 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-11 px-8">{isReadOnly ? 'Close Overview' : 'Cancel Changes'}</Button>
          {!isReadOnly && <Button onClick={handleSave} className="h-11 px-8 shadow-lg">Save Program Framework</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
