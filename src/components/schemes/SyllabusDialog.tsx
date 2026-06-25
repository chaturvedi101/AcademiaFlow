
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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookOpen, Globe, Link2, Loader2, Plus, ShieldAlert, Trash2, Hash, Info } from "lucide-react";
import { Syllabus, CorrelationLevel, CorrelationLevel as CorrelationLevelType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, where, getDocs, doc } from "firebase/firestore";

const PO_DEFINITIONS = [
  { code: 'PO1', title: 'Engineering Knowledge', desc: 'Apply mathematics, science, and engineering fundamentals.' },
  { code: 'PO2', title: 'Problem Analysis', desc: 'Identify and analyze complex engineering problems using first principles.' },
  { code: 'PO3', title: 'Design/Development', desc: 'Design systems for complex problems while considering safety and society.' },
  { code: 'PO4', title: 'Investigations', desc: 'Research, interpret data, and synthesize information.' },
  { code: 'PO5', title: 'Modern Tool Usage', desc: 'Apply appropriate techniques, resources, and IT tools.' },
  { code: 'PO6', title: 'Engineer and Society', desc: 'Apply reasoning based on safety, health, and legal issues.' },
  { code: 'PO7', title: 'Environment', desc: 'Understand the impact of professional solutions on the environment.' },
  { code: 'PO8', title: 'Ethics', desc: 'Apply ethical principles and commit to professional responsibilities.' },
  { code: 'PO9', title: 'Team Work', desc: 'Function effectively as an individual or team member.' },
  { code: 'PO10', title: 'Communication', desc: 'Communicate effectively on complex activities.' },
  { code: 'PO11', title: 'Project Management', desc: 'Apply engineering and management principles.' },
  { code: 'PO12', title: 'Life-long Learning', desc: 'Engage in independent and life-long learning.' },
];

const DEFAULT_DSE_GROUPS = [
  "Elective-I", "Elective-II", "Elective-III", "Elective-IV", "Elective-V", "Elective-VI"
];

const DEFAULT_OFE_GROUPS = [
  "Open Elective-I", "Open Elective-II", "Open Elective-III", "Open Elective-IV"
];

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  existingSyllabi?: Syllabus[];
  onSave: (data: Partial<Syllabus>) => void;
  programName?: string;
  branchName?: string;
  batchYear?: string;
  canEdit?: boolean;
  currentSchemeId?: string;
}

export function SyllabusDialog({ 
  open, 
  onOpenChange, 
  syllabus, 
  existingSyllabi = [],
  onSave,
  programName,
  branchName,
  batchYear,
  canEdit = true,
  currentSchemeId
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<any>(userDocRef);

  const [isCheckingGlobal, setIsCheckingGlobal] = useState(false);
  const [globalConflict, setGlobalConflict] = useState<{ schemeId: string; subjectCode: string; data: Syllabus } | null>(null);

  const [formData, setFormData] = useState<Partial<Syllabus>>({
    subjectCode: '',
    title: '',
    lectureCredits: 0,
    tutorialCredits: 0,
    practicalCredits: 0,
    credits: 0,
    semester: 1,
    type: 'Theory',
    creditCategory: 'DSC',
    units: [],
    poMappings: {},
    textBooks: [],
    referenceBooks: [],
    electiveGroupId: '',
    electiveGroupName: '',
    isCommonCourse: false,
    isOFESlot: false,
    isOFEContribution: false
  });

  const isCommonStaff = profile?.faculty === 'University-wide (Common BOS)' || profile?.role === 'admin' || profile?.role === 'dean_academic';

  const availableElectiveGroups = useMemo(() => {
    if (formData.creditCategory === 'DSE') return DEFAULT_DSE_GROUPS;
    if (formData.creditCategory === 'OFE') return DEFAULT_OFE_GROUPS;
    return [];
  }, [formData.creditCategory]);

  const generateAutoSubjectCode = useCallback(() => {
    if (!branchName) return '';
    
    let branchPrefix = 'PO';
    if (branchName !== 'Institutional Common Pool') {
      const lowerBranch = branchName.toLowerCase();
      if (lowerBranch.includes('production') && lowerBranch.includes('industrial')) {
        branchPrefix = 'PI';
      } else {
        branchPrefix = branchName.substring(0, 2).toUpperCase();
      }
    }

    const typeIndicator = (formData.lectureCredits || 0) + (formData.tutorialCredits || 0) > 0 ? 'L' : 'P';
    const isElective = formData.creditCategory === 'DSE' || formData.creditCategory === 'OFE';
    const categoryIndicator = isElective ? 'E' : 'C';
    
    // Use Year Digit instead of Semester Digit
    const yearDigit = Math.ceil((formData.semester || 1) / 2);

    const baseCode = `${branchPrefix}${typeIndicator}${categoryIndicator}${yearDigit}`;
    
    let sequence = 1;
    let finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;

    if (formData.electiveGroupId) {
      const peers = existingSyllabi.filter(s => s.electiveGroupId === formData.electiveGroupId);
      const isAlreadyInGroup = peers.some(p => p.id === formData.id || p.subjectCode === formData.subjectCode);
      
      let suffix = peers.length + (isAlreadyInGroup ? 0 : 1);
      
      if (isAlreadyInGroup && formData.subjectCode?.includes('.')) {
        const parts = formData.subjectCode.split('.');
        suffix = parseInt(parts[parts.length - 1]) || suffix;
      }
      
      finalCode = `${finalCode}.${suffix}`;
    } else {
      const existingCodes = existingSyllabi.filter(s => s.id !== formData.id && s.subjectCode !== formData.subjectCode).map(s => s.subjectCode);
      while (existingCodes.includes(finalCode)) {
        sequence++;
        finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;
        if (sequence > 99) break;
      }
    }

    return finalCode;
  }, [branchName, formData.lectureCredits, formData.tutorialCredits, formData.semester, formData.creditCategory, formData.electiveGroupId, existingSyllabi, formData.id, formData.subjectCode]);

  useEffect(() => {
    if (syllabus && open) {
      setFormData(prev => ({
        ...prev,
        ...syllabus,
        units: syllabus.units || [],
        poMappings: syllabus.poMappings || {},
        textBooks: syllabus.textBooks || [],
        referenceBooks: syllabus.referenceBooks || [],
      }));

      if (!syllabus.id && !syllabus.subjectCode) {
        setFormData(prev => ({ ...prev, subjectCode: generateAutoSubjectCode() }));
      }
    }
  }, [syllabus, open, generateAutoSubjectCode]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    setFormData(prev => ({ ...prev, credits: l + t + (p * 0.5) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  useEffect(() => {
    if (!open || !formData.subjectCode || formData.isOFESlot) return;
    const checkGlobalUniqueness = async (code: string) => {
      if (syllabus?.subjectCode === code) { setGlobalConflict(null); return; }
      
      setIsCheckingGlobal(true);
      try {
        const q = query(collectionGroup(db, 'syllabi'), where('subjectCode', '==', code));
        const snap = await getDocs(q);
        const conflict = snap.docs.find(d => d.data().schemeId !== currentSchemeId);
        
        if (conflict) {
          setGlobalConflict({ 
            schemeId: conflict.data().schemeId, 
            subjectCode: conflict.data().subjectCode, 
            data: conflict.data() as Syllabus 
          });
        } else {
          setGlobalConflict(null);
        }
      } catch (err: any) { 
        setGlobalConflict(null); 
      } finally { setIsCheckingGlobal(false); }
    };
    
    const timer = setTimeout(() => checkGlobalUniqueness(formData.subjectCode!), 600);
    return () => clearTimeout(timer);
  }, [formData.subjectCode, open, db, currentSchemeId, syllabus?.subjectCode, formData.isOFESlot]);

  const handleSave = () => {
    // Credit consistency check for elective groups
    if (formData.electiveGroupId) {
      const groupMembers = existingSyllabi.filter(s => s.electiveGroupId === formData.electiveGroupId && (s.id !== formData.id && s.subjectCode !== formData.subjectCode));
      if (groupMembers.length > 0) {
        const standardCredit = groupMembers[0].credits;
        if (formData.credits !== standardCredit) {
          toast({
            title: "Credit Mismatch",
            description: `All subjects in ${formData.electiveGroupId} must have ${standardCredit} credits.`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    onSave(formData);
    onOpenChange(false);
  };

  const isElective = formData.creditCategory === 'DSE' || formData.creditCategory === 'OFE';
  const isReadOnly = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            {isReadOnly ? 'Course View' : formData.id ? 'Edit Course Configuration' : 'New Course Configuration'}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'Viewing course specifications. Content is locked by faculty policy.' : 'Manage course identity, elective grouping, and academic content.'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8 pb-12">
            {globalConflict && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4 text-amber-800 text-sm animate-in fade-in slide-in-from-top-2">
                <Globe className="w-6 h-6 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="font-bold">Institutional Code Conflict: {globalConflict.subjectCode}</p>
                  <p className="text-xs mb-3">This code is already assigned in scheme <strong>{globalConflict.schemeId}</strong>. Use the existing content to ensure consistency.</p>
                  <Button size="sm" variant="outline" className="h-8 border-amber-300 hover:bg-amber-100" onClick={() => { 
                    setFormData({...formData, ...globalConflict.data, id: undefined, subjectCode: globalConflict.subjectCode}); 
                    setGlobalConflict(null); 
                  }}>
                    <Link2 className="w-3.5 h-3.5 mr-2" /> Link Existing Content
                  </Button>
                </div>
              </div>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="basic">Course Identity</TabsTrigger>
                <TabsTrigger value="syllabus" disabled={formData.isOFESlot}>Syllabus & Units</TabsTrigger>
                <TabsTrigger value="mapping" disabled={formData.isOFESlot}>PO Correlation</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Credit Category</Label>
                    <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => {
                      const isOfe = v === 'OFE';
                      setFormData({...formData, creditCategory: v, electiveGroupId: '', isOFESlot: isOfe, isOFEContribution: false});
                    }}>
                      <SelectTrigger className="h-11 border-primary/20"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DSC">DSC (Discipline Core)</SelectItem>
                        <SelectItem value="DSE">DSE (Discipline Elective)</SelectItem>
                        <SelectItem value="OFE">OFE (Open Elective Slot / Contribution)</SelectItem>
                        <SelectItem value="SEC">SEC (Skill Enhancement)</SelectItem>
                        {isCommonStaff && (
                          <>
                            <SelectItem value="VAC">VAC (Value Added)</SelectItem>
                            <SelectItem value="AEC">AEC (Ability Enhancement)</SelectItem>
                            <SelectItem value="MDC">MDC (Multi Disciplinary)</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.creditCategory === 'OFE' && !isReadOnly && (
                    <div className="p-4 bg-accent/5 rounded-xl border border-accent/10 space-y-3 animate-in zoom-in-95">
                      <Label className="text-xs font-bold uppercase text-accent">OFE Intent</Label>
                      <RadioGroup 
                        value={formData.isOFESlot ? 'slot' : 'contribution'} 
                        onValueChange={(val) => {
                          const isSlot = val === 'slot';
                          setFormData({
                            ...formData, 
                            isOFESlot: isSlot, 
                            isOFEContribution: !isSlot,
                            title: isSlot ? (formData.electiveGroupId || 'Open Elective') : '',
                            units: isSlot ? [] : formData.units
                          });
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="slot" id="slot" />
                          <Label htmlFor="slot" className="text-sm font-medium cursor-pointer">Define Scheme Slot</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="contribution" id="cont" />
                          <Label htmlFor="cont" className="text-sm font-medium cursor-pointer">Offer to University Pool</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      Subject Code 
                      {isCheckingGlobal && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                    </Label>
                    <Input 
                      disabled={isReadOnly || formData.isOFESlot} 
                      className="font-mono h-11 border-primary/20 focus:ring-primary/20" 
                      value={formData.isOFESlot ? 'SLOT-AUTO' : (formData.subjectCode || '')} 
                      onChange={e => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })} 
                    />
                    {formData.isOFESlot && <p className="text-[10px] text-muted-foreground">Slots are defined by grouping ID, not unique codes.</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Title / Slot Label</Label>
                    <Input 
                      disabled={isReadOnly || formData.isOFESlot} 
                      className="h-11 border-primary/20 focus:ring-primary/20"
                      value={formData.title || ''} 
                      onChange={e => setFormData({ ...formData, title: e.target.value })} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Academic Level</Label>
                    <Select disabled={isReadOnly} value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Theory">Theory</SelectItem>
                        <SelectItem value="Practical/Lab">Practical/Lab</SelectItem>
                        <SelectItem value="Sessional">Sessional</SelectItem>
                        <SelectItem value="Skill/IKS/Experiential">Skill / IKS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Semester</Label>
                    <Select disabled={isReadOnly} value={String(formData.semester)} onValueChange={v => setFormData({ ...formData, semester: Number(v) })}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {isElective && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-sm font-semibold text-accent">Grouping Identifier</Label>
                      <Select disabled={isReadOnly} value={formData.electiveGroupId} onValueChange={v => setFormData({...formData, electiveGroupId: v, title: formData.isOFESlot ? v : formData.title})}>
                        <SelectTrigger className="h-11 border-accent/30 focus:ring-accent/20">
                          <SelectValue placeholder="Select group slot..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableElectiveGroups.map(group => (
                            <SelectItem key={group} value={group}>{group}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="p-5 bg-primary/5 rounded-2xl border border-primary/10 grid grid-cols-4 gap-4 items-end">
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-muted-foreground">Lecture (L)</Label>
                     <Input type="number" disabled={isReadOnly} value={formData.lectureCredits ?? 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} className="h-10" />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-muted-foreground">Tutorial (T)</Label>
                     <Input type="number" disabled={isReadOnly} value={formData.tutorialCredits ?? 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} className="h-10" />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-muted-foreground">Practical (P)</Label>
                     <Input type="number" disabled={isReadOnly} value={formData.practicalCredits ?? 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} className="h-10" />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-[10px] uppercase font-bold text-primary">Weightage (Cr)</Label>
                     <Input value={formData.credits ?? 0} className="h-10 font-bold bg-white text-primary border-primary/20" readOnly />
                   </div>
                </div>

                {formData.isOFESlot && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3 text-blue-800 text-xs">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <p>You are defining an **Open Elective Slot**. This branch will reserve these credits in the scheme, but the content will be provided by other departments via the University Pool.</p>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="syllabus" className="space-y-6">
                 <div className="flex justify-between items-center">
                   <h3 className="text-lg font-headline font-bold">Course Units</h3>
                   {!isReadOnly && (
                     <Button size="sm" onClick={() => setFormData(prev => ({...prev, units: [...(prev.units || []), {id: Math.random().toString(36).substr(2, 9), title: '', content: '', courseOutcome: ''}]}))}>
                       <Plus className="w-4 h-4 mr-2" /> Add Unit
                     </Button>
                   )}
                 </div>
                 <div className="space-y-4">
                   {formData.units?.map((unit, idx) => (
                     <Card key={unit.id} className="border-muted bg-muted/5">
                       <CardContent className="p-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <Badge variant="secondary" className="font-bold">UNIT {idx + 1}</Badge>
                            {!isReadOnly && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 text-red-400" onClick={() => setFormData(prev => ({...prev, units: prev.units?.filter(u => u.id !== unit.id)}))}>
                                <Trash2 className="w-4 h-4"/>
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Unit Title</Label>
                            <Input disabled={isReadOnly} placeholder="Enter descriptive unit title..." value={unit.title} onChange={e => {
                              const u = [...(formData.units || [])]; u[idx].title = e.target.value; setFormData({...formData, units: u});
                            }} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Topics & Sub-topics</Label>
                            <Textarea disabled={isReadOnly} placeholder="Separated by semicolons..." value={unit.content} onChange={e => {
                              const u = [...(formData.units || [])]; u[idx].content = e.target.value; setFormData({...formData, units: u});
                            }} />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Learning Outcome (CO)</Label>
                            <Input disabled={isReadOnly} placeholder="Students will be able to..." value={unit.courseOutcome} onChange={e => {
                              const u = [...(formData.units || [])]; u[idx].courseOutcome = e.target.value; setFormData({...formData, units: u});
                            }} />
                          </div>
                       </CardContent>
                     </Card>
                   ))}
                   {(!formData.units || formData.units.length === 0) && (
                     <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/20">
                       <p className="text-sm text-muted-foreground">No units defined. Click "Add Unit" to begin building the syllabus.</p>
                     </div>
                   )}
                 </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6">
                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-4 text-xs text-primary mb-6">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <p>Map unit-wise Course Outcomes (COs) to standard Program Outcomes (POs). Level 3: High, Level 2: Medium, Level 1: Low, '-': No correlation.</p>
                </div>
                
                <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-24 bg-muted/50 sticky left-0 z-10">Outcome</TableHead>
                          {PO_DEFINITIONS.map(po => (
                            <TableHead key={po.code} className="text-center w-16 font-bold">{po.code}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.units?.map((unit, uIdx) => (
                          <TableRow key={unit.id}>
                            <TableCell className="font-bold text-xs bg-white sticky left-0 z-10">CO{uIdx+1}</TableCell>
                            {PO_DEFINITIONS.map(po => (
                              <TableCell key={po.code} className="p-1">
                                <Select 
                                  disabled={isReadOnly}
                                  value={formData.poMappings?.[unit.id]?.[po.code] || '-'} 
                                  onValueChange={val => {
                                    const m = { ...(formData.poMappings || {}) };
                                    if (!m[unit.id]) m[unit.id] = {};
                                    m[unit.id][po.code] = val as CorrelationLevelType;
                                    setFormData({ ...formData, poMappings: m });
                                  }}
                                >
                                  <SelectTrigger className="h-8 w-12 mx-auto border-none bg-transparent hover:bg-muted font-mono text-[10px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="min-w-[4rem]">
                                    {['1', '2', '3', '-'].map(lvl => (
                                      <SelectItem key={lvl} value={lvl} className="font-mono text-center">{lvl}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-background shrink-0 z-10">
          <Button variant="outline" className="h-11 px-8" onClick={() => onOpenChange(false)}>
            {isReadOnly ? 'Close' : 'Cancel'}
          </Button>
          {!isReadOnly && (
            <Button disabled={isCheckingGlobal || (!!globalConflict && !formData.isOFESlot)} className="h-11 px-8 shadow-lg" onClick={handleSave}>
              Save Configuration
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
