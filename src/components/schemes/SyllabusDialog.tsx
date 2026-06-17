
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator, Info, Plus, Trash2, Sparkles, Loader2, Wand2, AlertCircle, Clock, Book, BookOpen, ExternalLink, Video, FileDown, Hash, Library, Search } from "lucide-react";
import { Syllabus, CorrelationLevel, SyllabusUnit, CreditCategory } from "@/lib/types";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { suggestCOPOMapping } from "@/ai/flows/suggest-co-po-mapping";
import { useToast } from "@/hooks/use-toast";
import { exportSyllabusToPDF } from "@/lib/pdf-export";
import { useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, where, getDocs } from "firebase/firestore";

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

const CORRELATION_LEVELS: CorrelationLevel[] = ['1', '2', '3', '-'];

const COMMON_CATEGORIES: CreditCategory[] = ['VAC', 'AEC', 'SEC', 'MDC'];

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  existingSyllabi?: Syllabus[];
  onSave: (data: Partial<Syllabus>) => void;
  programName?: string;
  branchName?: string;
  batchYear?: string;
}

export function SyllabusDialog({ 
  open, 
  onOpenChange, 
  syllabus, 
  existingSyllabi = [],
  onSave,
  programName,
  branchName,
  batchYear
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [unitCount, setUnitCount] = useState(5);
  const [apiKeyError, setApiKeyError] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [showCourseBank, setShowCourseBank] = useState(false);
  const [commonPool, setCommonPool] = useState<Syllabus[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  
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
    isCommonCourse: false
  });

  const [newTextBook, setNewTextBook] = useState('');
  const [newReferenceBook, setNewReferenceBook] = useState('');
  const [newNptelLink, setNewNptelLink] = useState('');
  const [newYoutubeLink, setNewYoutubeLink] = useState('');

  const generateAutoSubjectCode = useCallback(() => {
    if (!branchName) return '';

    const branchPrefix = branchName.substring(0, 2).toUpperCase();
    const theoryHours = (formData.lectureCredits || 0) + (formData.tutorialCredits || 0);
    const typeIndicator = theoryHours > 0 ? 'L' : 'P';
    const category = formData.creditCategory || 'DSC';
    const categoryIndicator = (category === 'DSE' || category === 'OFE') ? 'E' : 'C';
    const semDigit = formData.semester || 1;

    const baseCode = `${branchPrefix}${typeIndicator}${categoryIndicator}${semDigit}`;
    let sequence = 1;
    let finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;

    const existingCodes = existingSyllabi
      .filter(s => s.id !== formData.id)
      .map(s => s.subjectCode);

    while (existingCodes.includes(finalCode)) {
      sequence++;
      finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;
      if (sequence > 99) break;
    }

    return finalCode;
  }, [branchName, formData.lectureCredits, formData.tutorialCredits, formData.semester, formData.creditCategory, existingSyllabi, formData.id]);

  useEffect(() => {
    if (syllabus) {
      setFormData(prev => ({
        ...prev,
        ...syllabus,
        units: syllabus.units || [],
        poMappings: syllabus.poMappings || {},
        textBooks: syllabus.textBooks || [],
        referenceBooks: syllabus.referenceBooks || [],
        nptelLinks: syllabus.nptelLinks || [],
        youtubeLinks: syllabus.youtubeLinks || [],
        isCommonCourse: syllabus.isCommonCourse || false
      }));

      if (!syllabus.id && !syllabus.subjectCode) {
        setFormData(prev => ({
          ...prev,
          subjectCode: generateAutoSubjectCode()
        }));
      }
    }
  }, [syllabus, open, generateAutoSubjectCode]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    const calculated = l + t + (p * 0.5);
    setFormData(prev => ({ ...prev, credits: calculated }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  const fetchCommonPool = async () => {
    setLoadingPool(true);
    try {
      const q = query(
        collectionGroup(db, 'syllabi'), 
        where('isCommonCourse', '==', true),
        where('creditCategory', '==', formData.creditCategory)
      );
      const snap = await getDocs(q);
      const courses = snap.docs.map(d => ({ ...d.data(), id: d.id } as Syllabus));
      setCommonPool(courses);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Pool Error', description: 'Could not fetch common courses.' });
    } finally {
      setLoadingPool(false);
    }
  };

  const handleFollowCourse = (course: Syllabus) => {
    setFormData(prev => ({
      ...prev,
      title: course.title,
      units: course.units,
      textBooks: course.textBooks,
      referenceBooks: course.referenceBooks,
      nptelLinks: course.nptelLinks,
      youtubeLinks: course.youtubeLinks,
      credits: course.credits,
      lectureCredits: course.lectureCredits,
      tutorialCredits: course.tutorialCredits,
      practicalCredits: course.practicalCredits,
      type: course.type,
      followedFromId: course.id
    }));
    setShowCourseBank(false);
    toast({ title: "Common Course Followed", description: `Synchronized with ${course.subjectCode}.` });
  };

  const handleAIGenerate = async () => {
    if (!formData.title) {
      toast({ title: "Title Required", description: "Please enter a subject title first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setApiKeyError(false);
    setQuotaError(null);
    try {
      const result = await generateSyllabusContent({
        title: formData.title,
        subjectCode: formData.subjectCode,
        unitCount: unitCount,
      });

      const newUnits = result.units.map(u => ({
        id: Math.random().toString(36).substr(2, 9),
        title: u.title,
        content: u.content,
        courseOutcome: u.courseOutcome,
      }));

      setFormData(prev => ({
        ...prev,
        units: newUnits,
        textBooks: [...(prev.textBooks || []), ...(result.suggestedTextBooks || [])],
        referenceBooks: [...(prev.referenceBooks || []), ...(result.suggestedReferences || [])],
        nptelLinks: [...(prev.nptelLinks || []), ...(result.suggestedNptelLinks || [])],
        youtubeLinks: [...(prev.youtubeLinks || []), ...(result.suggestedYoutubeLinks || [])],
        creditCategory: (result.suggestedCategory as any) || prev.creditCategory,
      }));

      toast({ title: "Syllabus Drafted", description: "AI generated units and suggested resources." });
    } catch (error: any) {
      const errorMessage = error.message || '';
      const isAuthError = errorMessage.includes('API_KEY') || errorMessage.includes('401') || errorMessage.includes('expired');
      const isQuotaError = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.toLowerCase().includes('quota');

      if (isAuthError) setApiKeyError(true);
      if (isQuotaError) setQuotaError("AI Services quota reached. Please wait 60 seconds.");
      
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIMap = async () => {
    if (!formData.units || formData.units.length === 0) {
      toast({ title: "Units Required", description: "Define syllabus units before mapping.", variant: "destructive" });
      return;
    }

    setIsMapping(true);
    setQuotaError(null);
    try {
      const result = await suggestCOPOMapping({
        subjectTitle: formData.title || 'Unknown Subject',
        units: formData.units.map(u => ({ id: u.id, courseOutcome: u.courseOutcome })),
      });

      setFormData(prev => ({
        ...prev,
        poMappings: result.mappings as any,
      }));

      toast({ title: "Mapping Suggested" });
    } catch (error: any) {
      toast({ title: "Mapping Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsMapping(false);
    }
  };

  const addManualUnit = () => {
    const newUnit: SyllabusUnit = {
      id: Math.random().toString(36).substr(2, 9),
      title: '',
      content: '',
      courseOutcome: '',
    };
    setFormData(prev => ({ ...prev, units: [...(prev.units || []), newUnit] }));
  };

  const removeUnit = (id: string) => {
    setFormData(prev => ({
      ...prev,
      units: prev.units?.filter(u => u.id !== id)
    }));
  };

  const updateUnit = (index: number, field: keyof SyllabusUnit, value: string) => {
    const newUnits = [...(formData.units || [])];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setFormData(prev => ({ ...prev, units: newUnits }));
  };

  const updatePOMapping = (unitId: string, poCode: string, level: CorrelationLevel) => {
    setFormData(prev => ({
      ...prev,
      poMappings: {
        ...(prev.poMappings || {}),
        [unitId]: {
          ...(prev.poMappings?.[unitId] || {}),
          [poCode]: level
        }
      }
    }));
  };

  const addResource = (type: 'text' | 'reference' | 'nptel' | 'youtube') => {
    let value = '';
    let field: keyof Partial<Syllabus> = 'textBooks';

    if (type === 'text') { value = newTextBook; field = 'textBooks'; setNewTextBook(''); }
    if (type === 'reference') { value = newReferenceBook; field = 'referenceBooks'; setNewReferenceBook(''); }
    if (type === 'nptel') { value = newNptelLink; field = 'nptelLinks'; setNewNptelLink(''); }
    if (type === 'youtube') { value = newYoutubeLink; field = 'youtubeLinks'; setNewYoutubeLink(''); }

    if (!value.trim()) return;
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] as string[] || []), value.trim()] }));
  };

  const removeItem = (type: 'text' | 'reference' | 'nptel' | 'youtube', index: number) => {
    let field: keyof Partial<Syllabus> = 'textBooks';
    if (type === 'text') field = 'textBooks';
    if (type === 'reference') field = 'referenceBooks';
    if (type === 'nptel') field = 'nptelLinks';
    if (type === 'youtube') field = 'youtubeLinks';

    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as string[] || []).filter((_, i) => i !== index)
    }));
  };

  const isFollowedCourse = !!formData.followedFromId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                {syllabus?.id ? 'Edit Subject Details' : 'Add New Subject Definition'}
                {isFollowedCourse && <Badge className="bg-emerald-100 text-emerald-700 border-none">Common Course Followed</Badge>}
              </DialogTitle>
              <DialogDescription>
                Configure credits, semester, unit content, and CO-PO mapping matrix.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {COMMON_CATEGORIES.includes(formData.creditCategory as any) && !syllabus?.id && (
                <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary" onClick={() => { setShowCourseBank(true); fetchCommonPool(); }}>
                  <Library className="w-4 h-4" /> University Course Bank
                </Button>
              )}
              {syllabus?.id && (
                <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary" onClick={() => exportSyllabusToPDF(formData, programName, branchName, batchYear)}>
                  <FileDown className="w-4 h-4" /> Export PDF
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8 pb-12">
            {apiKeyError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-red-800 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div><p className="font-bold">Google AI API Key Required</p></div>
                </div>
              </div>
            )}

            {quotaError && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-amber-800 text-sm"><p className="font-bold">AI Quota Limit Reached</p></div>
                </div>
              </div>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="syllabus">Units & COs</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="mapping">CO-PO Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-8 outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Code</Label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="e.g., COLC301" 
                        className="pl-9 font-mono"
                        value={formData.subjectCode || ''} 
                        onChange={e => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Title</Label>
                    <Input 
                      placeholder="e.g., Analysis of Algorithms" 
                      value={formData.title || ''}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      disabled={isFollowedCourse}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="p-5 bg-muted/30 rounded-2xl border space-y-6 lg:col-span-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider border-b pb-3">
                      <Calculator className="w-4 h-4" />
                      Credit Structure (L-T-P)
                    </div>
                    <div className="grid grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">L</Label>
                        <Input type="number" disabled={isFollowedCourse} value={formData.lectureCredits ?? 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">T</Label>
                        <Input type="number" disabled={isFollowedCourse} value={formData.tutorialCredits ?? 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">P</Label>
                        <Input type="number" disabled={isFollowedCourse} value={formData.practicalCredits ?? 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-primary uppercase">Total</Label>
                        <Input type="number" value={formData.credits ?? 0} className="font-bold bg-primary/5 text-primary" readOnly />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-accent/5 rounded-2xl border space-y-4">
                    <Label className="text-sm font-semibold">Semester & Category</Label>
                    <div className="space-y-4">
                      <Select value={String(formData.semester)} onValueChange={val => setFormData({ ...formData, semester: Number(val) })}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Semester" /></SelectTrigger>
                        <SelectContent>{[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={formData.creditCategory || 'DSC'} onValueChange={(val: any) => setFormData({ ...formData, creditCategory: val })}>
                        <SelectTrigger className="bg-white"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DSC">DSC (Core)</SelectItem>
                          <SelectItem value="DSE">DSE (Elective)</SelectItem>
                          <SelectItem value="OFE">OFE (Open Elective)</SelectItem>
                          <SelectItem value="VAC">VAC (Value Added)</SelectItem>
                          <SelectItem value="SEC">SEC (Skill)</SelectItem>
                          <SelectItem value="AEC">AEC (Ability Enhancement)</SelectItem>
                          <SelectItem value="MDC">MDC (Multi Disciplinary)</SelectItem>
                          <SelectItem value="CPF">CPF (Community Project)</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex items-center gap-2 p-2 bg-white rounded border border-primary/10">
                        <Label className="text-xs font-bold flex-1">University Common BOS Course?</Label>
                        <Input 
                          type="checkbox" 
                          className="w-4 h-4 accent-primary" 
                          checked={formData.isCommonCourse} 
                          onChange={e => setFormData({...formData, isCommonCourse: e.target.checked})}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6 outline-none focus-visible:ring-0">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="space-y-1">
                    <h3 className="font-headline font-bold text-primary">Unit Configuration</h3>
                    <p className="text-xs text-muted-foreground">Draft syllabus using AI or add units manually.</p>
                  </div>
                  {!isFollowedCourse && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button variant="outline" size="sm" onClick={handleAIGenerate} disabled={isGenerating} className="gap-2 bg-primary text-white hover:bg-primary/90 hover:text-white">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Syllabus Architect
                      </Button>
                      <Button variant="outline" size="sm" onClick={addManualUnit} className="gap-2">
                        <Plus className="w-4 h-4" /> Add Manual Unit
                      </Button>
                    </div>
                  )}
                  {isFollowedCourse && <p className="text-xs font-bold text-emerald-600">Locked to Common Pool Content</p>}
                </div>

                <div className="space-y-6">
                  {formData.units?.map((unit, index) => (
                    <Card key={unit.id} className="border-none shadow-sm bg-muted/10">
                      <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase">UNIT {index + 1}</Badge>
                        {!isFollowedCourse && (
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-50" onClick={() => removeUnit(unit.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Title</Label>
                            <Input disabled={isFollowedCourse} value={unit.title} onChange={e => updateUnit(index, 'title', e.target.value)} className="bg-white" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-primary">Course Outcome (CO)</Label>
                            <Input disabled={isFollowedCourse} value={unit.courseOutcome} onChange={e => updateUnit(index, 'courseOutcome', e.target.value)} className="bg-primary/5 border-primary/20 focus:bg-white" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Syllabus Content</Label>
                          <Textarea disabled={isFollowedCourse} value={unit.content} onChange={e => updateUnit(index, 'content', e.target.value)} className="min-h-[100px] bg-white" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="resources" className="space-y-8 outline-none focus-visible:ring-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-wider text-primary">Text Books</Label>
                      {!isFollowedCourse && (
                        <div className="flex gap-2">
                          <Input placeholder="Citation format..." value={newTextBook} onChange={e => setNewTextBook(e.target.value)} onKeyDown={e => e.key === 'Enter' && addResource('text')} />
                          <Button onClick={() => addResource('text')} size="icon" variant="secondary"><Plus className="w-4 h-4" /></Button>
                        </div>
                      )}
                      <ResourceList items={formData.textBooks} onRemove={i => removeItem('text', i)} readOnly={isFollowedCourse} />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-wider text-primary">Reference Books</Label>
                      {!isFollowedCourse && (
                        <div className="flex gap-2">
                          <Input placeholder="Citation format..." value={newReferenceBook} onChange={e => setNewReferenceBook(e.target.value)} onKeyDown={e => e.key === 'Enter' && addResource('reference')} />
                          <Button onClick={() => addResource('reference')} size="icon" variant="secondary"><Plus className="w-4 h-4" /></Button>
                        </div>
                      )}
                      <ResourceList items={formData.referenceBooks} onRemove={i => removeItem('reference', i)} readOnly={isFollowedCourse} />
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label className="text-sm font-bold uppercase tracking-wider text-primary">Digital Courses (NPTEL)</Label>
                      {!isFollowedCourse && (
                        <div className="flex gap-2">
                          <Input placeholder="URL..." value={newNptelLink} onChange={e => setNewNptelLink(e.target.value)} />
                          <Button onClick={() => addResource('nptel')} size="icon" variant="secondary"><Plus className="w-4 h-4" /></Button>
                        </div>
                      )}
                      <ResourceList items={formData.nptelLinks} onRemove={i => removeItem('nptel', i)} isLink readOnly={isFollowedCourse} />
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6 outline-none focus-visible:ring-0">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-800 text-sm">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 shrink-0" />
                    <p>Map unit outcomes against Program Outcomes.</p>
                  </div>
                  {!isFollowedCourse && (
                    <Button size="sm" variant="outline" onClick={handleAIMap} disabled={isMapping || !formData.units?.length}>
                      {isMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Smart Suggestions
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[200px] font-bold">COs</TableHead>
                        {PO_DEFINITIONS.map(po => (
                          <TableHead key={po.code} className="text-center w-[60px] text-[10px] font-bold uppercase">{po.code}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.units?.map((unit, uIdx) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-bold text-primary">CO{uIdx + 1}</TableCell>
                          {PO_DEFINITIONS.map(po => (
                            <TableCell key={po.code} className="p-1 text-center border-l">
                              <Select 
                                disabled={isFollowedCourse}
                                value={formData.poMappings?.[unit.id]?.[po.code] || '-'} 
                                onValueChange={(val: CorrelationLevel) => updatePOMapping(unit.id, po.code, val)}
                              >
                                <SelectTrigger className="h-9 w-12 mx-auto border-none bg-transparent hover:bg-muted focus:ring-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="min-w-[60px]">
                                  {CORRELATION_LEVELS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}
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

        <DialogFooter className="p-6 bg-muted/20 border-t shrink-0 z-10">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6 h-11">Cancel</Button>
          <Button onClick={() => { onSave(formData); onOpenChange(false); }} className="px-8 h-11 shadow-lg">Save Configuration</Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={showCourseBank} onOpenChange={setShowCourseBank}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b shrink-0 bg-background">
            <DialogTitle className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              University Course Bank: {formData.creditCategory}
            </DialogTitle>
            <DialogDescription>Developed by University Level Common BOS</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            {loadingPool ? (
              <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {commonPool.map(course => (
                  <Card key={course.id} className="hover:border-primary transition-colors cursor-pointer" onClick={() => handleFollowCourse(course)}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="font-bold text-primary">{course.subjectCode} - {course.title}</p>
                        <p className="text-xs text-muted-foreground">Credits: {course.credits} | L-T-P: {course.lectureCredits}-{course.tutorialCredits}-{course.practicalCredits}</p>
                      </div>
                      <Button variant="secondary" size="sm">Follow Course</Button>
                    </CardContent>
                  </Card>
                ))}
                {commonPool.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground italic">No common courses found for this category.</div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function ResourceList({ items, onRemove, isLink, readOnly }: { items?: string[], onRemove: (i: number) => void, isLink?: boolean, readOnly?: boolean }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-muted/20 border rounded-lg group">
          <span className="text-sm truncate max-w-[90%]">
            {isLink ? (
              <a href={item.startsWith('http') ? item : `https://${item}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1.5">
                {item} <ExternalLink className="w-3 h-3" />
              </a>
            ) : item}
          </span>
          {!readOnly && (
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onRemove(i)}>
              <Trash2 className="w-3.5 h-3.5 text-red-400" />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
