
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
import { Calculator, Info, Plus, Trash2, Sparkles, Loader2, Wand2, AlertCircle, Clock, Book, BookOpen, ExternalLink, Video, FileDown, Hash, Library, Search, ShieldAlert } from "lucide-react";
import { Syllabus, CorrelationLevel, SyllabusUnit, CreditCategory } from "@/lib/types";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { suggestCOPOMapping } from "@/ai/flows/suggest-co-po-mapping";
import { useToast } from "@/hooks/use-toast";
import { exportSyllabusToPDF } from "@/lib/pdf-export";
import { useFirestore, useUser, useDoc, useMemoFirebase } from "@/firebase";
import { collectionGroup, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";

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
const INSTITUTIONAL_CATEGORIES: CreditCategory[] = ['VAC', 'AEC', 'MDC'];

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
  canEdit = true
}: SyllabusDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<any>(userDocRef);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [unitCount, setUnitCount] = useState(5);
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

  // Rules for Automated Subject Code Generation
  const generateAutoSubjectCode = useCallback(() => {
    if (!branchName) return '';
    
    // 1. Branch Prefix (2 chars)
    let branchPrefix = 'PO';
    if (branchName !== 'Institutional Common Pool') {
      const lowerBranch = branchName.toLowerCase();
      // Specifically handle Production and Industrial as 'PI'
      if (lowerBranch.includes('production') && lowerBranch.includes('industrial')) {
        branchPrefix = 'PI';
      } else {
        branchPrefix = branchName.substring(0, 2).toUpperCase();
      }
    }

    // 2. Type Indicator (1 char): L for Theory/Tutorial, P for Practical
    const typeIndicator = (formData.lectureCredits || 0) + (formData.tutorialCredits || 0) > 0 ? 'L' : 'P';
    
    // 3. Category Indicator (1 char): E for Elective, C for Core
    const isElective = formData.creditCategory === 'DSE' || formData.creditCategory === 'OFE';
    const categoryIndicator = isElective ? 'E' : 'C';
    
    // 4. Semester Digit (1 digit)
    const semDigit = formData.semester || 1;

    const baseCode = `${branchPrefix}${typeIndicator}${categoryIndicator}${semDigit}`;
    
    // 5. Sequence (2 digits) to ensure uniqueness
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
    if (syllabus && open) {
      setFormData(prev => ({
        ...prev,
        ...syllabus,
        units: syllabus.units || [],
        poMappings: syllabus.poMappings || {},
        textBooks: syllabus.textBooks || [],
        referenceBooks: syllabus.referenceBooks || [],
        nptelLinks: syllabus.nptelLinks || [],
        youtubeLinks: syllabus.youtubeLinks || [],
        isCommonCourse: syllabus.isCommonCourse || (profile?.faculty === 'University-wide (Common BOS)' && INSTITUTIONAL_CATEGORIES.includes(syllabus.creditCategory as any))
      }));

      // If this is a new subject, generate a code automatically
      if (!syllabus.id && !syllabus.subjectCode) {
        setFormData(prev => ({ ...prev, subjectCode: generateAutoSubjectCode() }));
      }
    }
  }, [syllabus, open, generateAutoSubjectCode, profile]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    setFormData(prev => ({ ...prev, credits: l + t + (p * 0.5) }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  const isCodeDuplicate = useMemo(() => {
    if (!formData.subjectCode) return false;
    return existingSyllabi.some(s => s.subjectCode === formData.subjectCode && s.id !== formData.id);
  }, [formData.subjectCode, formData.id, existingSyllabi]);

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
      const uniqueCourses = Array.from(new Map(courses.map(c => [c.subjectCode, c])).values());
      setCommonPool(uniqueCourses);
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
      followedFromId: course.id,
      isCommonCourse: true
    }));
    setShowCourseBank(false);
    toast({ title: "Common Course Followed" });
  };

  const handleAIGenerate = async () => {
    if (!formData.title) return;
    setIsGenerating(true);
    try {
      const result = await generateSyllabusContent({
        title: formData.title,
        subjectCode: formData.subjectCode,
        unitCount: unitCount,
      });
      setFormData(prev => ({
        ...prev,
        units: result.units.map(u => ({ id: Math.random().toString(36).substr(2, 9), ...u })),
        textBooks: [...(prev.textBooks || []), ...(result.suggestedTextBooks || [])],
        referenceBooks: [...(prev.referenceBooks || []), ...(result.suggestedReferences || [])],
        nptelLinks: [...(prev.nptelLinks || []), ...(result.suggestedNptelLinks || [])],
        youtubeLinks: [...(prev.youtubeLinks || []), ...(result.suggestedYoutubeLinks || [])],
      }));
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIMap = async () => {
    if (!formData.units?.length) return;
    setIsMapping(true);
    try {
      const result = await suggestCOPOMapping({
        subjectTitle: formData.title || 'Unknown Subject',
        units: formData.units.map(u => ({ id: u.id, courseOutcome: u.courseOutcome })),
      });
      setFormData(prev => ({ ...prev, poMappings: result.mappings as any }));
    } catch (error: any) {
      toast({ title: "Mapping Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsMapping(false);
    }
  };

  const addManualUnit = () => {
    const newUnit: SyllabusUnit = { id: Math.random().toString(36).substr(2, 9), title: '', content: '', courseOutcome: '' };
    setFormData(prev => ({ ...prev, units: [...(prev.units || []), newUnit] }));
  };

  const removeUnit = (id: string) => setFormData(prev => ({ ...prev, units: prev.units?.filter(u => u.id !== id) }));

  const updateUnit = (index: number, field: keyof SyllabusUnit, value: string) => {
    const newUnits = [...(formData.units || [])];
    newUnits[index] = { ...newUnits[index], [field]: value };
    setFormData(prev => ({ ...prev, units: newUnits }));
  };

  const updatePOMapping = (unitId: string, poCode: string, level: CorrelationLevel) => {
    setFormData(prev => ({
      ...prev,
      poMappings: { ...(prev.poMappings || {}), [unitId]: { ...(prev.poMappings?.[unitId] || {}), [poCode]: level } }
    }));
  };

  const addResource = (type: 'text' | 'reference') => {
    let value = '';
    let field: keyof Partial<Syllabus> = 'textBooks';
    if (type === 'text') { value = newTextBook; field = 'textBooks'; setNewTextBook(''); }
    if (type === 'reference') { value = newReferenceBook; field = 'referenceBooks'; setNewReferenceBook(''); }
    if (!value.trim()) return;
    setFormData(prev => ({ ...prev, [field]: [...(prev[field] as string[] || []), value.trim()] }));
  };

  const removeItem = (type: 'text' | 'reference', index: number) => {
    let field: keyof Partial<Syllabus> = 'textBooks';
    if (type === 'text') field = 'textBooks';
    if (type === 'reference') field = 'referenceBooks';
    setFormData(prev => ({ ...prev, [field]: (prev[field] as string[] || []).filter((_, i) => i !== index) }));
  };

  const isFollowedCourse = !!formData.followedFromId || (formData as any).isFromCommonPool;
  const isReadOnly = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="font-headline text-2xl flex items-center gap-2">
                {isReadOnly ? 'View Subject Details' : (syllabus?.id ? 'Edit Subject Details' : 'Add New Subject Definition')}
                {isFollowedCourse && <Badge className="bg-emerald-100 text-emerald-700 border-none">Common Course Content</Badge>}
              </DialogTitle>
              <DialogDescription>
                {isReadOnly ? 'Institutional course content managed by Common BOS.' : 'Configure course code, content, and credit distribution.'}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              {INSTITUTIONAL_CATEGORIES.includes(formData.creditCategory as any) && !syllabus?.id && canEdit && (
                <Button variant="outline" size="sm" className="gap-2 border-primary/20 text-primary" onClick={() => { setShowCourseBank(true); fetchCommonPool(); }}>
                  <Library className="w-4 h-4" /> University Course Bank
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8 pb-12">
            {isCodeDuplicate && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-800 text-sm animate-in fade-in zoom-in-95">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
                <p className="font-bold">Error: Subject Code "{formData.subjectCode}" already exists in this scheme. Use a unique code.</p>
              </div>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="syllabus">Units & COs</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="mapping">CO-PO Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Code (Document ID)</Label>
                    <div className="relative">
                      <Hash className={`absolute left-3 top-2.5 h-4 w-4 ${isCodeDuplicate ? 'text-red-500' : 'text-muted-foreground'}`} />
                      <Input 
                        disabled={isReadOnly}
                        placeholder="e.g., COLC301" 
                        className={`pl-9 font-mono ${isCodeDuplicate ? 'border-red-500 ring-red-500' : ''}`}
                        value={formData.subjectCode || ''} 
                        onChange={e => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase().replace(/\s+/g, '') })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Title</Label>
                    <Input placeholder="e.g., Analysis of Algorithms" value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} disabled={isFollowedCourse || isReadOnly} />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="p-5 bg-muted/30 rounded-2xl border space-y-6 lg:col-span-2">
                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider border-b pb-3">
                      <Calculator className="w-4 h-4" /> Credit Structure (L-T-P)
                    </div>
                    <div className="grid grid-cols-4 gap-6">
                      <div className="space-y-2">
                        <Label className="text-xs">L</Label>
                        <Input type="number" disabled={isFollowedCourse || isReadOnly} value={formData.lectureCredits ?? 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">T</Label>
                        <Input type="number" disabled={isFollowedCourse || isReadOnly} value={formData.tutorialCredits ?? 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">P</Label>
                        <Input type="number" disabled={isFollowedCourse || isReadOnly} value={formData.practicalCredits ?? 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-primary">Total</Label>
                        <Input type="number" value={formData.credits ?? 0} className="font-bold bg-primary/5 text-primary" readOnly />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 bg-accent/5 rounded-2xl border space-y-4">
                    <Label className="text-sm font-semibold">Semester & Category</Label>
                    <div className="space-y-4">
                      <Select disabled={isReadOnly} value={String(formData.semester)} onValueChange={val => setFormData({ ...formData, semester: Number(val) })}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select disabled={isReadOnly} value={formData.creditCategory || 'DSC'} onValueChange={(val: any) => setFormData({ ...formData, creditCategory: val })}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DSC">DSC (Core)</SelectItem>
                          <SelectItem value="DSE">DSE (Elective)</SelectItem>
                          <SelectItem value="OFE">OFE (Open Elective)</SelectItem>
                          <SelectItem value="VAC">VAC (Value Added)</SelectItem>
                          <SelectItem value="SEC">SEC (Skill Enhancement)</SelectItem>
                          <SelectItem value="AEC">AEC (Ability Enhancement)</SelectItem>
                          <SelectItem value="MDC">MDC (Multi Disciplinary)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                <div className="flex justify-between items-center p-4 bg-primary/5 rounded-xl border">
                  <div className="space-y-1">
                    <h3 className="font-headline font-bold text-primary">Course Content</h3>
                  </div>
                  {!isFollowedCourse && !isReadOnly && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleAIGenerate} disabled={isGenerating} className="bg-primary text-white">
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} Syllabus AI
                      </Button>
                      <Button variant="outline" size="sm" onClick={addManualUnit}><Plus className="w-4 h-4" /> Add Unit</Button>
                    </div>
                  )}
                </div>
                {formData.units?.map((unit, index) => (
                  <Card key={unit.id} className="border-none shadow-sm bg-muted/10">
                    <div className="bg-primary/5 px-4 py-2 border-b flex justify-between">
                      <Badge variant="outline">UNIT {index + 1}</Badge>
                      {!isFollowedCourse && !isReadOnly && <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => removeUnit(unit.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <Input disabled={isFollowedCourse || isReadOnly} value={unit.title} placeholder="Title" onChange={e => updateUnit(index, 'title', e.target.value)} />
                        <Input disabled={isFollowedCourse || isReadOnly} value={unit.courseOutcome} placeholder="Outcome" onChange={e => updateUnit(index, 'courseOutcome', e.target.value)} />
                      </div>
                      <Textarea disabled={isFollowedCourse || isReadOnly} value={unit.content} placeholder="Topics..." onChange={e => updateUnit(index, 'content', e.target.value)} />
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="resources" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Label className="font-bold">Text Books</Label>
                    {!isFollowedCourse && !isReadOnly && (
                      <div className="flex gap-2">
                        <Input value={newTextBook} onChange={e => setNewTextBook(e.target.value)} />
                        <Button onClick={() => addResource('text')} size="icon"><Plus className="w-4 h-4" /></Button>
                      </div>
                    )}
                    <ResourceList items={formData.textBooks} onRemove={i => removeItem('text', i)} readOnly={isFollowedCourse || isReadOnly} />
                  </div>
                  <div className="space-y-4">
                    <Label className="font-bold">Reference Materials</Label>
                    {!isFollowedCourse && !isReadOnly && (
                      <div className="flex gap-2">
                        <Input value={newReferenceBook} onChange={e => setNewReferenceBook(e.target.value)} />
                        <Button onClick={() => addResource('reference')} size="icon"><Plus className="w-4 h-4" /></Button>
                      </div>
                    )}
                    <ResourceList items={formData.referenceBooks} onRemove={i => removeItem('reference', i)} readOnly={isFollowedCourse || isReadOnly} />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6">
                <div className="overflow-x-auto border rounded-xl">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead>COs</TableHead>
                        {PO_DEFINITIONS.map(po => <TableHead key={po.code} className="text-center w-12">{po.code}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.units?.map((unit, uIdx) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-bold">CO{uIdx + 1}</TableCell>
                          {PO_DEFINITIONS.map(po => (
                            <TableCell key={po.code} className="p-1 border-l">
                              <Select disabled={isFollowedCourse || isReadOnly} value={formData.poMappings?.[unit.id]?.[po.code] || '-'} onValueChange={(val: CorrelationLevel) => updatePOMapping(unit.id, po.code, val)}>
                                <SelectTrigger className="h-9 w-12 border-none bg-transparent hover:bg-muted"><SelectValue /></SelectTrigger>
                                <SelectContent className="min-w-[60px]">{CORRELATION_LEVELS.map(lvl => <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>)}</SelectContent>
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isReadOnly && (
            <Button 
              disabled={isCodeDuplicate || !formData.subjectCode} 
              onClick={() => { onSave(formData); onOpenChange(false); }}
            >
              Save Configuration
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <Dialog open={showCourseBank} onOpenChange={setShowCourseBank}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b">
            <DialogTitle>Institutional Course Bank: {formData.creditCategory}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            {loadingPool ? <Loader2 className="w-8 h-8 animate-spin mx-auto" /> : (
              <div className="grid grid-cols-1 gap-4">
                {commonPool.map(course => (
                  <Card key={course.id} className="hover:border-primary cursor-pointer" onClick={() => handleFollowCourse(course)}>
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-bold">{course.subjectCode} - {course.title}</p>
                        <p className="text-xs text-muted-foreground">Credits: {course.credits}</p>
                      </div>
                      <Button variant="secondary" size="sm">Follow Course</Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function ResourceList({ items, onRemove, readOnly }: { items?: string[], onRemove: (i: number) => void, readOnly?: boolean }) {
  if (!items?.length) return null;
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between p-2 border rounded group">
          <span className="text-sm truncate">{item}</span>
          {!readOnly && <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => onRemove(i)}><Trash2 className="w-3.5 h-3.5" /></Button>}
        </div>
      ))}
    </div>
  );
}
