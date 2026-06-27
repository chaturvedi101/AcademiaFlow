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
import { BookOpen, Globe, Link2, Loader2, Plus, Trash2, Search, Layers, AlertTriangle, Book, Video, ExternalLink, Sparkles, Clock, ListPlus, ChevronDown, ChevronUp, CheckCircle2, Info } from "lucide-react";
import { Syllabus, CorrelationLevel as CorrelationLevelType, CreditRules, CreditCategory, SyllabusUnit, SyllabusSubUnit } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collection, query, where, getDocs, doc, collectionGroup } from "firebase/firestore";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { cn } from "@/lib/utils";

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
  { code: 'PO12', title: 'Life-long Learning', engage: 'Engage in independent and life-long learning.' },
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [poolResults, setPoolResults] = useState<Syllabus[]>([]);
  const [showPoolPicker, setShowPoolPicker] = useState(false);
  const [isManuallyEditedCode, setIsManuallyEditedCode] = useState(false);
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({});
  
  const [codeWarning, setCodeWarning] = useState<string | null>(null);
  const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
  const [lastCheckedCode, setLastCheckedCode] = useState<string | null>(null);

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
    nptelLinks: [],
    youtubeLinks: [],
    electiveGroupId: '',
    electiveGroupName: '',
    isCommonCourse: false,
    isOFESlot: false,
    isOFEContribution: false
  });

  const isStrictlyCommonBOS = profile?.faculty === 'University-wide (Common BOS)';
  const isGlobalAdmin = ['admin', 'dean_academic'].includes(profile?.role || '');

  const totalTeachingHours = useMemo(() => {
    return formData.units?.reduce((acc, unit) => acc + (Number(unit.hours) || 0), 0) || 0;
  }, [formData.units]);

  const visibleCategories = useMemo(() => {
    const all = ['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC', 'PRJ'] as CreditCategory[];
    if (isGlobalAdmin) return all;

    if (isStrictlyCommonBOS) {
      return all.filter(c => !['DSC', 'DSE', 'PRJ'].includes(c));
    } else {
      return all.filter(c => !['AEC', 'VAC', 'MDC'].includes(c));
    }
  }, [isGlobalAdmin, isStrictlyCommonBOS]);

  const availableElectiveGroups = useMemo(() => {
    const defaults = formData.creditCategory === 'DSE' ? DEFAULT_DSE_GROUPS : (formData.creditCategory === 'OFE' ? DEFAULT_OFE_GROUPS : []);
    if (formData.electiveGroupId && !defaults.includes(formData.electiveGroupId)) {
      return [formData.electiveGroupId, ...defaults];
    }
    return defaults;
  }, [formData.creditCategory, formData.electiveGroupId]);

  const generateAutoSubjectCode = useCallback(() => {
    if (!branchName) return '';
    
    let prefix = 'GN';
    const cat = formData.creditCategory || '';
    
    if (cat === 'AEC') prefix = 'AE';
    else if (cat === 'MDC') prefix = 'MD';
    else if (cat === 'VAC') prefix = 'VA';
    else {
      if (branchName !== 'Institutional Common Pool') {
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
    if (isElective) sequence = 50;
    if (cat === 'PRJ') sequence = 95;

    const baseCode = `${prefix}${pedagogy}${pillar}${yearDigit}`;
    let finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;

    if (formData.electiveGroupId) {
      const peers = existingSyllabi.filter(s => s.electiveGroupId === formData.electiveGroupId);
      const isAlreadyInGroup = peers.some(p => p.id === formData.id || p.subjectCode === formData.subjectCode);
      let suffix = peers.length + (isAlreadyInGroup ? 0 : 1);
      finalCode = `${finalCode}.${suffix}`;
    } else {
      const existingCodes = existingSyllabi
        .filter(s => s.id !== formData.id && s.subjectCode !== formData.subjectCode)
        .map(s => s.subjectCode);

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

      setFormData({
        subjectCode: '',
        title: initialTitle,
        lectureCredits: 0,
        tutorialCredits: 0,
        practicalCredits: 0,
        credits: 0,
        semester: 1,
        type: 'Theory',
        creditCategory: initialCategory,
        units: [],
        poMappings: {},
        textBooks: [],
        referenceBooks: [],
        nptelLinks: [],
        youtubeLinks: [],
        electiveGroupId: '',
        electiveGroupName: '',
        isCommonCourse: false,
        isOFESlot: false,
        isOFEContribution: false,
        ...syllabus,
        title: initialTitle,
        creditCategory: initialCategory,
      });
      
      setIsManuallyEditedCode(false);
      setCodeWarning(null);
      setLastCheckedCode(null);
      setPoolResults([]);
      setShowPoolPicker(false);
      setExpandedUnits({});
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
    if (!open || !code || code.length < 4 || code === lastCheckedCode) {
      if (!code) setCodeWarning(null);
      return;
    }

    const checkGlobalUniquenessAndInherit = async () => {
      setIsCheckingUniqueness(true);
      try {
        const syllabiGroupQuery = query(
          collectionGroup(db, 'syllabi'),
          where('subjectCode', '==', code)
        );
        const snap = await getDocs(syllabiGroupQuery);
        
        const existingRecord = snap.docs.find(d => d.data().schemeId !== currentSchemeId);
        
        if (existingRecord) {
          const data = existingRecord.data() as Syllabus;
          const isGenericSlot = formData.isSlot || formData.title?.toLowerCase().includes('slot') || !formData.id;
          
          if (isGenericSlot && isManuallyEditedCode) {
            setFormData(prev => ({
              ...prev,
              title: data.title,
              lectureCredits: data.lectureCredits,
              tutorialCredits: data.tutorialCredits,
              practicalCredits: data.practicalCredits,
              credits: data.credits,
              type: data.type,
              creditCategory: data.creditCategory,
              units: data.units || [],
              poMappings: data.poMappings || {},
              textBooks: data.textBooks || [],
              referenceBooks: data.referenceBooks || [],
              nptelLinks: data.nptelLinks || [],
              youtubeLinks: data.youtubeLinks || [],
              electiveGroupName: data.electiveGroupName,
              electiveGroupId: data.electiveGroupId
            }));

            toast({ title: "Institutional Specification Synced", description: `Fetched contents for code ${code}.` });
          }

          setCodeWarning(`Institutional Code Detected: This code is registered to "${data.title}" elsewhere.`);
        } else {
          setCodeWarning(null);
        }
        setLastCheckedCode(code);
      } catch (err) {
        console.error("Global lookup failed:", err);
      } finally {
        setIsCheckingUniqueness(false);
      }
    };

    const timer = setTimeout(checkGlobalUniquenessAndInherit, 800);
    return () => clearTimeout(timer);
  }, [formData.subjectCode, currentSchemeId, db, open, toast, lastCheckedCode, isManuallyEditedCode, formData.isSlot, formData.title, formData.id]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    setFormData(prev => ({ ...prev, credits: l + t + (p * 0.5) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  const handleAISyllabusGenerate = async () => {
    if (!formData.title) {
      toast({ title: "Identity Required", description: "Please enter a subject title first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateSyllabusContent({
        title: formData.title,
        subjectCode: formData.subjectCode,
        unitCount: 5,
        level: 'UG'
      });

      const units: SyllabusUnit[] = result.units.map(u => ({
        id: Math.random().toString(36).substr(2, 9),
        title: u.title,
        content: u.content,
        hours: u.hours || 0,
        courseOutcome: u.courseOutcome,
        subUnits: u.subUnits?.map(su => ({
          id: Math.random().toString(36).substr(2, 9),
          title: su.title,
          content: su.content,
          hours: su.hours || 0
        })) || []
      }));

      setFormData(prev => ({
        ...prev,
        units,
        textBooks: result.suggestedTextBooks,
        referenceBooks: result.suggestedReferences,
        nptelLinks: result.suggestedNptelLinks,
        youtubeLinks: result.suggestedYoutubeLinks,
        creditCategory: (result.suggestedCategory as any) || prev.creditCategory
      }));

      toast({ title: "AI Generation Complete", description: "Syllabus content populated." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "AI Architect Failed", description: err.message || "Failed to generate content." });
    } finally {
      setIsGenerating(false);
    }
  };

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
        toast({ title: "Pool Not Found", description: `No common pool for batch ${batchYear}.` });
        setIsPoolSearching(false);
        return;
      }

      const results: Syllabus[] = [];
      for (const schemeId of poolSchemeIds) {
        const syllabiQuery = query(
          collection(db, 'syllabi'),
          where('creditCategory', '==', formData.creditCategory)
        );
        const syllabiSnap = await getDocs(syllabiQuery);
        syllabiSnap.forEach(doc => {
          const data = doc.data() as Syllabus;
          if (!data.isSlot && !data.isOFESlot) {
            results.push({ ...data, id: doc.id });
          }
        });
      }

      setPoolResults(results);
      setShowPoolPicker(true);
    } catch (err) {
      console.error("Pool search failed:", err);
      toast({ variant: "destructive", title: "Discovery Error", description: "Institutional pool connection failed." });
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
    toast({ title: "Course Synchronized", description: `${poolCourse.subjectCode} applied.` });
  };

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  const handleUpdateArrayField = (field: keyof Syllabus, index: number, value: string) => {
    const arr = [...(formData[field] as string[] || [])];
    arr[index] = value;
    setFormData({ ...formData, [field]: arr });
  };

  const handleAddArrayField = (field: keyof Syllabus) => {
    const arr = [...(formData[field] as string[] || []), ''];
    setFormData({ ...formData, [field]: arr });
  };

  const handleRemoveArrayField = (field: keyof Syllabus, index: number) => {
    const arr = [...(formData[field] as string[] || [])].filter((_, i) => i !== index);
    setFormData({ ...formData, [field]: arr });
  };

  const toggleUnitExpansion = (unitId: string) => {
    setExpandedUnits(prev => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const isReadOnly = !canEdit;
  const isInstitutionalCategory = ['VAC', 'AEC', 'MDC', 'SEC', 'OFE'].includes(formData.creditCategory || '');
  const isElectiveCategory = ['DSE', 'OFE'].includes(formData.creditCategory || '');
  const hideGroupSelection = syllabus?.electiveGroupId !== undefined && syllabus.electiveGroupId !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-primary" />
              {isReadOnly ? 'Course Specification' : formData.id ? 'Configure Academic Course' : 'Create New Course'}
            </div>
            {!isReadOnly && !formData.isOFESlot && (
              <Button size="sm" className="gap-2 bg-gradient-to-r from-primary to-accent border-none shadow-md" onClick={handleAISyllabusGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                GenAI Architect
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly ? 'Standardized institutional specification.' : 'Define course identity, content units, outcomes, and resource mappings.'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8 pb-12">
            {codeWarning && (
              <div className="p-4 border rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-1 bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="flex flex-col">
                   <p className="font-bold">Institutional Code Detected</p>
                   <p className="text-xs opacity-90">{codeWarning}</p>
                </div>
              </div>
            )}

            {(isInstitutionalCategory && !isReadOnly && !formData.isOFESlot) && (
              <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-100 p-2 rounded-lg"><Globe className="w-6 h-6 text-emerald-600" /></div>
                  <div>
                    <p className="text-sm font-bold text-emerald-900">Institutional Pool discovery</p>
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
                  <CardTitle className="text-sm font-headline">Approved Pool Syllabi</CardTitle>
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
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Identity & Meta</TabsTrigger>
                <TabsTrigger value="syllabus" disabled={formData.isOFESlot}>Academic Content</TabsTrigger>
                <TabsTrigger value="resources" disabled={formData.isOFESlot}>Learning Resources</TabsTrigger>
                <TabsTrigger value="mapping" disabled={formData.isOFESlot}>Outcome Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Credit Category</Label>
                    <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
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
                    <Input disabled={isReadOnly} className="h-11" placeholder="e.g. Programming for Problem Solving" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                  </div>
                </div>

                {isElectiveCategory && (
                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 text-accent">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase">Elective Pool Context</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {!hideGroupSelection && (
                        <div className="space-y-2">
                          <Label className="text-xs">Group Identifier (e.g. Elective-I)</Label>
                          <Select disabled={isReadOnly} value={formData.electiveGroupId} onValueChange={v => setFormData({...formData, electiveGroupId: v})}>
                            <SelectTrigger className="h-10"><SelectValue placeholder="Select group..." /></SelectTrigger>
                            <SelectContent>
                              {availableElectiveGroups.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className={hideGroupSelection ? "col-span-full space-y-2" : "space-y-2"}>
                        <Label className="text-xs">Friendly Pool Name</Label>
                        <Input disabled={isReadOnly} className="h-10" placeholder="e.g. CS Electives" value={formData.electiveGroupName || ''} onChange={e => setFormData({...formData, electiveGroupName: e.target.value})} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Code</Label>
                    <div className="relative">
                      <Input disabled={isReadOnly} className="font-mono h-11" value={formData.subjectCode || ''} onChange={e => {
                        setIsManuallyEditedCode(true);
                        setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() });
                      }} />
                      {isCheckingUniqueness && <Loader2 className="absolute right-3 top-3.5 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
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
                   <h3 className="text-lg font-headline font-bold">Subject Units & Hours</h3>
                   {!isReadOnly && (
                     <Button size="sm" variant="outline" className="gap-2" onClick={() => setFormData(prev => ({...prev, units: [...(prev.units || []), {id: Math.random().toString(36).substr(2, 9), title: '', content: '', hours: 0, courseOutcome: '', subUnits: []}]}))}>
                       <Plus className="w-4 h-4" /> Add Unit
                     </Button>
                   )}
                 </div>
                 <div className="space-y-4">
                   {formData.units?.map((unit, idx) => (
                     <Card key={unit.id} className="border-muted overflow-hidden">
                       <CardHeader className="p-4 bg-muted/20 flex flex-row items-center justify-between space-y-0">
                          <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-primary text-white">UNIT {idx + 1}</Badge>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleUnitExpansion(unit.id)}>
                              {expandedUnits[unit.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                            <span className="font-bold text-sm">{unit.title || 'Untitled Unit'}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 bg-white border px-3 py-1 rounded-lg">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Hours:</Label>
                              <Input 
                                disabled={isReadOnly} 
                                type="number" 
                                className="w-12 h-6 p-1 text-center border-none focus-visible:ring-0 font-bold" 
                                value={unit.hours} 
                                onChange={e => {
                                  const u = [...(formData.units || [])]; 
                                  u[idx].hours = Number(e.target.value); 
                                  setFormData({...formData, units: u});
                                }} 
                              />
                            </div>
                            {(!isReadOnly && canDelete) && (
                              <Button variant="ghost" size="sm" className="h-8 w-8 text-red-400" onClick={() => setFormData(prev => ({...prev, units: prev.units?.filter(u => u.id !== unit.id)}))}>
                                <Trash2 className="w-4 h-4"/>
                              </Button>
                            )}
                          </div>
                       </CardHeader>
                       <CardContent className={cn("p-4 space-y-4", !expandedUnits[unit.id] && "hidden")}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="space-y-2">
                               <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Title</Label>
                               <Input disabled={isReadOnly} placeholder="Unit Title" value={unit.title} onChange={e => {
                                 const u = [...(formData.units || [])]; u[idx].title = e.target.value; setFormData({...formData, units: u});
                               }} />
                             </div>
                             <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Outcome (CO)</Label>
                                <Input disabled={isReadOnly} placeholder="Learning outcome..." value={unit.courseOutcome} onChange={e => {
                                  const u = [...(formData.units || [])]; u[idx].courseOutcome = e.target.value; setFormData({...formData, units: u});
                                }} />
                             </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Summary</Label>
                            <Textarea disabled={isReadOnly} className="min-h-[60px]" placeholder="Broad topics..." value={unit.content} onChange={e => {
                              const u = [...(formData.units || [])]; u[idx].content = e.target.value; setFormData({...formData, units: u});
                            }} />
                          </div>

                          <div className="mt-4 space-y-3 p-4 bg-muted/5 rounded-xl border border-dashed">
                             <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2 text-muted-foreground">
                                   <ListPlus className="w-4 h-4" />
                                   <span className="text-[11px] font-bold uppercase tracking-wider">Sub-Unit Breakdown</span>
                                </div>
                                {!isReadOnly && (
                                  <Button size="sm" variant="ghost" className="h-7 text-[10px] uppercase" onClick={() => {
                                    const u = [...(formData.units || [])];
                                    if (!u[idx].subUnits) u[idx].subUnits = [];
                                    u[idx].subUnits!.push({ id: Math.random().toString(36).substr(2, 9), title: '', content: '', hours: 0 });
                                    setFormData({...formData, units: u});
                                  }}>
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Sub-Topic
                                  </Button>
                                )}
                             </div>
                             <div className="space-y-3">
                                {unit.subUnits?.map((sub, sIdx) => (
                                  <div key={sub.id} className="grid grid-cols-12 gap-3 items-start bg-white p-3 rounded-lg border shadow-sm">
                                     <div className="col-span-11 space-y-3">
                                        <div className="flex gap-4">
                                           <Input disabled={isReadOnly} className="h-8 text-xs font-bold" placeholder="Sub-topic Title" value={sub.title} onChange={e => {
                                             const u = [...(formData.units || [])]; u[idx].subUnits![sIdx].title = e.target.value; setFormData({...formData, units: u});
                                           }} />
                                           <div className="flex items-center gap-2 shrink-0">
                                              <Label className="text-[9px] uppercase font-bold text-muted-foreground">Hrs:</Label>
                                              <Input disabled={isReadOnly} type="number" className="w-14 h-8 text-xs text-center" value={sub.hours} onChange={e => {
                                                const u = [...(formData.units || [])]; u[idx].subUnits![sIdx].hours = Number(e.target.value); setFormData({...formData, units: u});
                                              }} />
                                           </div>
                                        </div>
                                     </div>
                                     <div className="col-span-1 flex justify-center pt-1">
                                        {!isReadOnly && (
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-50" onClick={() => {
                                            const u = [...(formData.units || [])];
                                            u[idx].subUnits = u[idx].subUnits!.filter(s => s.id !== sub.id);
                                            setFormData({...formData, units: u});
                                          }}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        )}
                                     </div>
                                  </div>
                                ))}
                             </div>
                          </div>
                       </CardContent>
                     </Card>
                   ))}
                 </div>
                 
                 <div className="mt-8 flex justify-between items-center p-5 bg-primary/5 rounded-2xl border border-primary/20">
                    <div>
                       <p className="text-[11px] font-bold text-primary uppercase tracking-widest">Syllabus Complexity Audit</p>
                       <p className="text-xs text-muted-foreground">Live institutional workload audit.</p>
                    </div>
                    <div className="flex items-center gap-6">
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Units</p>
                          <p className="text-xl font-bold">{formData.units?.length || 0}</p>
                       </div>
                       <div className="h-10 w-px bg-primary/20"></div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Teaching Hours</p>
                          <p className={cn("text-2xl font-black font-headline", totalTeachingHours > 0 ? "text-primary" : "text-amber-500")}>
                             {totalTeachingHours} Hrs
                          </p>
                       </div>
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="resources" className="space-y-8">
                <ResourceSection 
                  title="Recommended Text Books" 
                  icon={<Book className="w-4 h-4" />}
                  field="textBooks"
                  items={formData.textBooks || []}
                  onAdd={() => handleAddArrayField('textBooks')}
                  onUpdate={(idx, val) => handleUpdateArrayField('textBooks', idx, val)}
                  onRemove={(idx) => handleRemoveArrayField('textBooks', idx)}
                  isReadOnly={isReadOnly}
                  placeholder="Author, Title, Publisher"
                />

                <ResourceSection 
                  title="Reference Materials" 
                  icon={<ExternalLink className="w-4 h-4" />}
                  field="referenceBooks"
                  items={formData.referenceBooks || []}
                  onAdd={() => handleAddArrayField('referenceBooks')}
                  onUpdate={(idx, val) => handleUpdateArrayField('referenceBooks', idx, val)}
                  onRemove={(idx) => handleRemoveArrayField('referenceBooks', idx)}
                  isReadOnly={isReadOnly}
                  placeholder="Title or Reference URL"
                />

                <ResourceSection 
                  title="NPTEL / SWAYAM" 
                  icon={<Link2 className="w-4 h-4" />}
                  field="nptelLinks"
                  items={formData.nptelLinks || []}
                  onAdd={() => handleAddArrayField('nptelLinks')}
                  onUpdate={(idx, val) => handleUpdateArrayField('nptelLinks', idx, val)}
                  onRemove={(idx) => handleRemoveArrayField('nptelLinks', idx)}
                  isReadOnly={isReadOnly}
                  placeholder="Course Portal Link"
                />

                <ResourceSection 
                  title="YouTube Resources" 
                  icon={<Video className="w-4 h-4" />}
                  field="youtubeLinks"
                  items={formData.youtubeLinks || []}
                  onAdd={() => handleAddArrayField('youtubeLinks')}
                  onUpdate={(idx, val) => handleUpdateArrayField('youtubeLinks', idx, val)}
                  onRemove={(idx) => handleRemoveArrayField('youtubeLinks', idx)}
                  isReadOnly={isReadOnly}
                  placeholder="Video URL"
                />
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
          {!isReadOnly && (
            <Button onClick={handleSave} className="gap-2">
              {codeWarning && <Info className="w-4 h-4" />}
              Save Specification
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResourceSection({ title, icon, items, onAdd, onUpdate, onRemove, isReadOnly, placeholder }: any) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-bold">
          {icon}
          <h4 className="text-sm">{title}</h4>
        </div>
        {!isReadOnly && (
          <Button size="sm" variant="ghost" onClick={onAdd} className="h-7 text-[10px] uppercase font-bold tracking-wider">
            <Plus className="w-3 h-3 mr-1" /> Add
          </Button>
        )}
      </div>
      <div className="space-y-2">
        {items.map((item: string, idx: number) => (
          <div key={idx} className="flex gap-2">
            <Input 
              disabled={isReadOnly}
              placeholder={placeholder}
              value={item}
              onChange={e => onUpdate(idx, e.target.value)}
              className="h-9 text-sm"
            />
            {!isReadOnly && (
              <Button variant="ghost" size="icon" className="h-9 w-9 text-red-400 shrink-0" onClick={() => onRemove(idx)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
