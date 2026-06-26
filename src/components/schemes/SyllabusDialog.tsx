
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { BookOpen, Globe, Link2, Loader2, Plus, ShieldAlert, Trash2, Hash, Info, GraduationCap, ClipboardCheck, Search, Layers, AlertTriangle } from "lucide-react";
import { Syllabus, CorrelationLevel as CorrelationLevelType, CreditRules, SubjectType, CreditCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc, collectionGroup } from "firebase/firestore";

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
  const [poolResults, setPoolResults] = useState<Syllabus[]>([]);
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [isManuallyEditedCode, setIsManuallyEditedCode] = useState(false);
  
  const [codeConflict, setCodeConflict] = useState<string | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);

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

  const isStrictlyCommonBOS = profile?.faculty === 'University-wide (Common BOS)';
  const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile?.role || '');

  const visibleCategories = useMemo(() => {
    const all = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'] as CreditCategory[];
    if (isGlobalAdmin) return all;

    if (isStrictlyCommonBOS) {
      return all.filter(c => !['DSC', 'DSE', 'PRJ'].includes(c));
    } else {
      return all.filter(c => !['AEC', 'VAC', 'MDC'].includes(c));
    }
  }, [profile, isGlobalAdmin, isStrictlyCommonBOS]);

  const availableElectiveGroups = useMemo(() => {
    if (formData.creditCategory === 'DSE') return DEFAULT_DSE_GROUPS;
    if (formData.creditCategory === 'OFE') return DEFAULT_OFE_GROUPS;
    return [];
  }, [formData.creditCategory]);

  const generateAutoSubjectCode = useCallback(() => {
    if (!branchName) return '';
    
    let prefix = 'RT';
    const cat = formData.creditCategory || '';
    
    if (cat === 'AEC') prefix = 'AE';
    else if (cat === 'MDC') prefix = 'MD';
    else if (cat === 'VAC') prefix = 'VA';
    else if (cat === 'OFE') prefix = 'RT';
    else {
      if (branchName === 'Institutional Common Pool') {
        prefix = 'RT';
      } else {
        const lowerBranch = branchName.toLowerCase();
        if (lowerBranch.includes('production') && lowerBranch.includes('industrial')) {
          prefix = 'PI';
        } else {
          prefix = branchName.substring(0, 2).toUpperCase();
        }
      }
    }

    let pedagogy = 'L';
    if (cat === 'PRJ') {
      pedagogy = 'I';
    } else if (formData.type === 'Lab/Sessional') {
      pedagogy = 'P';
    }

    const isElective = ['DSE', 'OFE'].includes(cat);
    const pillar = isElective ? 'E' : 'C';
    const yearDigit = Math.ceil((formData.semester || 1) / 2);
    
    let sequence = 1;
    if (cat === 'SEC') sequence = 40;
    if (cat === 'DSE') sequence = 50;
    if (cat === 'PRJ') sequence = 95;

    const baseCode = `${prefix}${pedagogy}${pillar}${yearDigit}`;
    let finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;

    if (formData.electiveGroupId) {
      const peers = existingSyllabi.filter(s => s.electiveGroupId === formData.electiveGroupId);
      const isAlreadyInGroup = peers.some(p => p.id === formData.id || p.subjectCode === formData.subjectCode);
      let suffix = peers.length + (isAlreadyInGroup ? 0 : 1);
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
  }, [branchName, formData.type, formData.semester, formData.creditCategory, formData.electiveGroupId, existingSyllabi, formData.id, formData.subjectCode]);

  useEffect(() => {
    if (syllabus && open) {
      const isNew = !syllabus.id;
      const initialCategory = syllabus.creditCategory || (isNew && isStrictlyCommonBOS ? 'AEC' : 'DSC');

      let initialTitle = syllabus.title || '';
      if (isNew && syllabus.electiveGroupId) {
        const peers = existingSyllabi.filter(s => s.electiveGroupId === syllabus.electiveGroupId);
        const nextNum = peers.length + 1;
        initialTitle = `Elective Subject ${nextNum}`;
      }

      setFormData(prev => ({
        ...prev,
        ...syllabus,
        title: initialTitle,
        creditCategory: initialCategory,
        units: syllabus.units || [],
        poMappings: syllabus.poMappings || {},
        textBooks: syllabus.textBooks || [],
        referenceBooks: syllabus.referenceBooks || [],
      }));
      
      setIsManuallyEditedCode(false);
      setCodeConflict(null);
      setPoolResults([]);
      setShowPoolPicker(false);
    }
  }, [syllabus, open, isStrictlyCommonBOS, existingSyllabi]);

  useEffect(() => {
    if (open && !syllabus?.id && !isManuallyEditedCode && !formData.isOFESlot) {
      const newCode = generateAutoSubjectCode();
      if (newCode && newCode !== formData.subjectCode) {
        setFormData(prev => ({ ...prev, subjectCode: newCode }));
      }
    }
  }, [formData.type, formData.semester, formData.creditCategory, formData.electiveGroupId, open, syllabus?.id, isManuallyEditedCode, formData.isOFESlot, generateAutoSubjectCode, formData.subjectCode]);

  useEffect(() => {
    const code = formData.subjectCode;
    if (!open || !code || code === 'POOL-ELECTIVE' || code === 'SLOT' || code.length < 5) {
      setCodeConflict(null);
      return;
    }

    const checkGlobalUniqueness = async () => {
      setIsCheckingUniqueness(true);
      try {
        const syllabiGroupQuery = query(
          collectionGroup(db, 'syllabi'),
          where('subjectCode', '==', code)
        );
        const snap = await getDocs(syllabiGroupQuery);
        const conflict = snap.docs.find(d => d.data().schemeId !== currentSchemeId);
        
        if (conflict) {
          setCodeConflict(`Warning: Code ${code} is already registered in another University scheme.`);
        } else {
          setCodeConflict(null);
        }
      } catch (err) {
        console.error("Global uniqueness check failed:", err);
      } finally {
        setIsCheckingUniqueness(false);
      }
    };

    const timer = setTimeout(checkGlobalUniqueness, 800);
    return () => clearTimeout(timer);
  }, [formData.subjectCode, currentSchemeId, db, open]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    setFormData(prev => ({ ...prev, credits: l + t + (p * 0.5) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  const searchUniversityPool = async () => {
    setIsPoolSearching(true);
    setPoolResults([]);
    try {
      const schemesQuery = query(
        collection(db, 'schemes'), 
        where('isCommonPoolScheme', '==', true),
        where('batchYear', '==', batchYear)
      );
      const schemesSnap = await getDocs(schemesQuery);
      const poolSchemeIds = schemesSnap.docs.map(d => d.id);

      if (poolSchemeIds.length === 0) {
        toast({ title: "Pool Not Found", description: `No institutional common pool defined for batch ${batchYear}.` });
        setIsPoolSearching(false);
        return;
      }

      const results: Syllabus[] = [];
      for (const schemeId of poolSchemeIds) {
        const syllabiQuery = query(
          collection(db, 'schemes', schemeId, 'syllabi'),
          where('creditCategory', '==', formData.creditCategory)
        );
        const syllabiSnap = await getDocs(syllabiQuery);
        syllabiSnap.forEach(doc => {
          const data = doc.data() as Syllabus;
          if (!data.isSlot && !data.isOFESlot && data.subjectCode) {
            results.push({ ...data, id: doc.id });
          }
        });
      }

      setPoolResults(results);
      setShowPoolPicker(true);
    } catch (err) {
      console.error("Pool search failed:", err);
      toast({ variant: "destructive", title: "Discovery Error", description: "Failed to connect to the institutional pool." });
    } finally {
      setIsPoolSearching(false);
    }
  };

  const applyPoolCourse = (poolCourse: Syllabus) => {
    setFormData({
      ...formData,
      ...poolCourse,
      id: formData.id,
      schemeId: currentSchemeId,
      semester: formData.semester,
      isSlot: false,
      isOFESlot: false
    });
    setShowPoolPicker(false);
    toast({ title: "Course Synchronized", description: `${poolCourse.subjectCode} has been applied to this slot.` });
  };

  const handleSave = () => {
    if (formData.electiveGroupId) {
      const groupMembers = existingSyllabi.filter(s => s.electiveGroupId === formData.electiveGroupId && (s.id !== formData.id && s.subjectCode !== formData.subjectCode));
      if (groupMembers.length > 0) {
        const standardCredit = groupMembers[0].credits;
        if (formData.credits !== standardCredit) {
          toast({ title: "Credit Mismatch", description: `All subjects in ${formData.electiveGroupId} must have ${standardCredit} credits.`, variant: "destructive" });
          return;
        }
      }
    }
    onSave(formData);
    onOpenChange(false);
  };

  const isReadOnly = !canEdit;
  const isTheory = formData.type === 'Theory';
  const isInstitutionalCategory = ['VAC', 'AEC', 'MDC', 'SEC', 'OFE'].includes(formData.creditCategory || '');
  const isElectiveCategory = ['DSE', 'OFE'].includes(formData.creditCategory || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-primary" />
            {isReadOnly ? 'Course Specification' : formData.id ? 'Configure Academic Course' : 'Create New Course'}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'Standardized specification. Managed by the Board of Studies.' : 'Define identity, content units, and learning resource mappings.'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8 pb-12">
            {codeConflict && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="font-bold">{codeConflict}</p>
              </div>
            )}

            {(isInstitutionalCategory && !isReadOnly && !formData.isOFESlot) && (
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-2 rounded-lg"><Globe className="w-6 h-6 text-emerald-600" /></div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Institutional Pool Discovery</p>
                    <p className="text-[11px] text-emerald-700 leading-tight">Standardize this slot via the University-wide Board of Studies pool.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="bg-white" onClick={searchUniversityPool} disabled={isPoolSearching}>
                  {isPoolSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Search className="w-3.5 h-3.5 mr-2" />}
                  Search University Pool
                </Button>
              </div>
            )}

            {showPoolPicker && (
              <Card className="border-emerald-200 bg-emerald-50/10">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b bg-emerald-50/30">
                  <CardTitle className="text-sm font-headline">Approved {formData.creditCategory} Syllabi</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setShowPoolPicker(false)}>Cancel</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead className="pl-4">Code</TableHead><TableHead>Course Title</TableHead><TableHead className="text-center">Credits</TableHead><TableHead className="text-right pr-4">Action</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {poolResults.map(course => (
                        <TableRow key={course.id}>
                          <TableCell className="pl-4 font-mono font-bold text-emerald-700">{course.subjectCode}</TableCell>
                          <TableCell className="text-xs font-medium">{course.title}</TableCell>
                          <TableCell className="text-center text-xs font-bold">{course.credits} Cr</TableCell>
                          <TableCell className="text-right pr-4">
                            <Button size="sm" variant="ghost" onClick={() => applyPoolCourse(course)}>Import</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="basic">Identity & Meta</TabsTrigger>
                <TabsTrigger value="syllabus" disabled={formData.isOFESlot}>Academic Content</TabsTrigger>
                <TabsTrigger value="mapping" disabled={formData.isOFESlot}>Outcome Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Credit Category</Label>
                    <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v, isOFESlot: v === 'OFE'})}>
                      <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {visibleCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Title</Label>
                    <Input disabled={isReadOnly || formData.isOFESlot} className="h-11" placeholder="e.g. Machine Learning" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                  </div>
                </div>

                {isElectiveCategory && (
                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-accent">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Elective Group Identity</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Group Identifier (e.g. Elective-I)</Label>
                        <Select disabled={isReadOnly} value={formData.electiveGroupId} onValueChange={v => setFormData({...formData, electiveGroupId: v})}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Select group..." /></SelectTrigger>
                          <SelectContent>
                            {availableElectiveGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Friendly Pool Name</Label>
                        <Input disabled={isReadOnly} className="h-10" placeholder="e.g. Cyber Security Specialization" value={formData.electiveGroupName || ''} onChange={e => setFormData({...formData, electiveGroupName: e.target.value})} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">Grouping subjects here ensures they share a single credit slot in the scheme structure.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Code</Label>
                    <Input disabled={isReadOnly || formData.isOFESlot} className="font-mono h-11" value={formData.isOFESlot ? 'POOL-ELECTIVE' : (formData.subjectCode || '')} onChange={e => {
                      setIsManuallyEditedCode(true);
                      setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() });
                    }} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Type</Label>
                    <Select disabled={isReadOnly} value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Theory">Theory</SelectItem><SelectItem value="Lab/Sessional">Lab/Sessional</SelectItem></SelectContent></Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Sem</Label>
                    <Select disabled={isReadOnly} value={String(formData.semester)} onValueChange={v => setFormData({ ...formData, semester: Number(v) })}><SelectTrigger className="h-11"><SelectValue /></SelectTrigger><SelectContent>{[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>)}</SelectContent></Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-sm font-semibold">L-T-P Distribution</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Lecture (L)</Label>
                      <Input disabled={isReadOnly} type="number" min="0" value={formData.lectureCredits || 0} onChange={e => setFormData({ ...formData, lectureCredits: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Tutorial (T)</Label>
                      <Input disabled={isReadOnly} type="number" min="0" value={formData.tutorialCredits || 0} onChange={e => setFormData({ ...formData, tutorialCredits: Number(e.target.value) })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground">Practical (P)</Label>
                      <Input disabled={isReadOnly} type="number" min="0" value={formData.practicalCredits || 0} onChange={e => setFormData({ ...formData, practicalCredits: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="p-3 bg-primary/5 rounded-lg flex items-center justify-between">
                    <span className="text-sm font-medium">Calculated Credits</span>
                    <Badge variant="secondary" className="text-lg font-bold px-4">{formData.credits || 0}</Badge>
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="syllabus" className="space-y-6">
                 <div className="flex justify-between items-center">
                   <h3 className="text-lg font-headline font-bold">Subject Units</h3>
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
                            <Badge variant="secondary">UNIT {idx + 1}</Badge>
                            {(!isReadOnly && canDelete) && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 text-red-400" onClick={() => setFormData(prev => ({...prev, units: prev.units?.filter(u => u.id !== unit.id)}))}>
                                <Trash2 className="w-4 h-4"/>
                              </Button>
                            )}
                          </div>
                          <Input disabled={isReadOnly} placeholder="Title" value={unit.title} onChange={e => {
                            const u = [...(formData.units || [])]; u[idx].title = e.target.value; setFormData({...formData, units: u});
                          }} />
                          <Textarea disabled={isReadOnly} placeholder="Content" value={unit.content} onChange={e => {
                            const u = [...(formData.units || [])]; u[idx].content = e.target.value; setFormData({...formData, units: u});
                          }} />
                       </CardContent>
                     </Card>
                   ))}
                   {(!formData.units || formData.units.length === 0) && (
                     <div className="text-center py-12 border border-dashed rounded-xl bg-muted/20">
                       <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-10" />
                       <p className="text-sm text-muted-foreground italic">No syllabus units defined yet.</p>
                     </div>
                   )}
                 </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6">
                <div className="border rounded-xl overflow-hidden bg-white">
                  <ScrollArea className="w-full">
                    <Table>
                      <TableHeader className="bg-muted/50"><TableRow><TableHead className="w-24">Unit/CO</TableHead>{PO_DEFINITIONS.map(po => <TableHead key={po.code} className="text-center w-16">{po.code}</TableHead>)}</TableRow></TableHeader>
                      <TableBody>
                        {formData.units?.map((unit, uIdx) => (
                          <TableRow key={unit.id}><TableCell className="font-bold">CO{uIdx+1}</TableCell>{PO_DEFINITIONS.map(po => (
                            <TableCell key={po.code} className="p-1">
                              <Select disabled={isReadOnly} value={formData.poMappings?.[unit.id]?.[po.code] || '-'} onValueChange={val => {
                                const m = { ...(formData.poMappings || {}) }; if (!m[unit.id]) m[unit.id] = {}; m[unit.id][po.code] = val as CorrelationLevelType; setFormData({ ...formData, poMappings: m });
                              }}><SelectTrigger className="h-8 w-12 mx-auto"><SelectValue /></SelectTrigger><SelectContent>{['1', '2', '3', '-'].map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent></Select>
                            </TableCell>
                          ))}</TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-background shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{isReadOnly ? 'Close' : 'Cancel'}</Button>
          {!isReadOnly && <Button onClick={handleSave} disabled={!!codeConflict}>Save Specification</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
