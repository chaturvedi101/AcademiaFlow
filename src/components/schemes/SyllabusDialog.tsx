
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calculator, Plus, Trash2, Sparkles, Loader2, Hash, Library, AlertCircle, ShieldAlert, Globe, Link2, Layers } from "lucide-react";
import { Syllabus, CorrelationLevel, SyllabusUnit, CreditCategory } from "@/lib/types";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { useToast } from "@/hooks/use-toast";
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

  const [isGenerating, setIsGenerating] = useState(false);
  const [unitCount, setUnitCount] = useState(5);
  const [showCourseBank, setShowCourseBank] = useState(false);
  const [commonPool, setCommonPool] = useState<Syllabus[]>([]);
  const [loadingPool, setLoadingPool] = useState(false);
  
  const [globalConflict, setGlobalConflict] = useState<{ schemeId: string; subjectCode: string; data: Syllabus } | null>(null);
  const [isCheckingGlobal, setIsCheckingGlobal] = useState(false);

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
    isCommonCourse: false
  });

  const [newTextBook, setNewTextBook] = useState('');
  const [newReferenceBook, setNewReferenceBook] = useState('');

  const isCommonStaff = profile?.faculty === 'University-wide (Common BOS)' || profile?.role === 'admin' || profile?.role === 'dean_academic';

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
    const yearDigit = Math.ceil((formData.semester || 1) / 2);

    const baseCode = `${branchPrefix}${typeIndicator}${categoryIndicator}${yearDigit}`;
    
    let sequence = 1;
    let finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;

    if (formData.electiveGroupId) {
      // Find suffix
      const peers = existingSyllabi.filter(s => s.electiveGroupId === formData.electiveGroupId);
      const suffix = peers.length + (formData.id ? 0 : 1);
      finalCode = `${finalCode}.${suffix}`;
    } else {
      const existingCodes = existingSyllabi.filter(s => s.id !== formData.id).map(s => s.subjectCode);
      while (existingCodes.includes(finalCode)) {
        sequence++;
        finalCode = `${baseCode}${String(sequence).padStart(2, '0')}`;
        if (sequence > 99) break;
      }
    }

    return finalCode;
  }, [branchName, formData.lectureCredits, formData.tutorialCredits, formData.semester, formData.creditCategory, formData.electiveGroupId, existingSyllabi, formData.id]);

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
    if (!open || !formData.subjectCode) return;
    const checkGlobalUniqueness = async (code: string) => {
      if (syllabus?.subjectCode === code) { setGlobalConflict(null); return; }
      setIsCheckingGlobal(true);
      try {
        const q = query(collectionGroup(db, 'syllabi'), where('subjectCode', '==', code));
        const snap = await getDocs(q);
        const conflict = snap.docs.find(d => d.data().schemeId !== currentSchemeId);
        if (conflict) {
          setGlobalConflict({ schemeId: conflict.data().schemeId, subjectCode: conflict.data().subjectCode, data: conflict.data() as Syllabus });
        } else {
          setGlobalConflict(null);
        }
      } catch (err: any) { setGlobalConflict(null); }
      finally { setIsCheckingGlobal(false); }
    };
    const timer = setTimeout(() => checkGlobalUniqueness(formData.subjectCode!), 600);
    return () => clearTimeout(timer);
  }, [formData.subjectCode, open, db, currentSchemeId, syllabus?.subjectCode]);

  const handleSave = () => {
    onSave(formData);
    onOpenChange(false);
  };

  const isElective = formData.creditCategory === 'DSE' || formData.creditCategory === 'OFE';
  const isReadOnly = !canEdit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[95vh] flex flex-col p-0 overflow-hidden border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            {isReadOnly ? 'Subject Content' : 'Subject Configuration'}
          </DialogTitle>
          <DialogDescription>Manage academic details and elective grouping.</DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 w-full min-h-0">
          <div className="p-6 space-y-8 pb-12">
            {globalConflict && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-4 text-amber-800 text-sm">
                <Globe className="w-6 h-6 text-amber-600" />
                <div className="flex-1">
                  <p className="font-bold">Institutional Conflict: {globalConflict.subjectCode}</p>
                  <p className="text-xs mb-3">Available in scheme {globalConflict.schemeId}. Link this data?</p>
                  <Button size="sm" variant="outline" onClick={() => { setFormData({...formData, ...globalConflict.data, id: undefined, subjectCode: globalConflict.subjectCode}); setGlobalConflict(null); }}>
                    <Link2 className="w-3.5 h-3.5 mr-2" /> Link Existing Content
                  </Button>
                </div>
              </div>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-8">
                <TabsTrigger value="basic">Identity</TabsTrigger>
                <TabsTrigger value="syllabus">Syllabus</TabsTrigger>
                <TabsTrigger value="resources">Resources</TabsTrigger>
                <TabsTrigger value="mapping">PO Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Code</Label>
                    <Input disabled={isReadOnly} className="font-mono" value={formData.subjectCode || ''} onChange={e => setFormData({ ...formData, subjectCode: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Title</Label>
                    <Input disabled={isReadOnly} value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                  </div>
                </div>

                {isElective && (
                  <Card className="border-accent/20 bg-accent/5">
                    <CardContent className="p-4 space-y-4">
                      <div className="flex items-center gap-2 text-accent font-bold text-sm">
                        <Layers className="w-4 h-4" /> Elective Group Settings
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Group Identifier (e.g. Elective-I)</Label>
                          <Input disabled={isReadOnly} placeholder="Elective-I" value={formData.electiveGroupId || ''} onChange={e => setFormData({...formData, electiveGroupId: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Group Descriptive Name</Label>
                          <Input disabled={isReadOnly} placeholder="Advanced Computing Pool" value={formData.electiveGroupName || ''} onChange={e => setFormData({...formData, electiveGroupName: e.target.value})} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="p-5 bg-muted/30 rounded-2xl border grid grid-cols-4 gap-4">
                   <div className="space-y-2">
                     <Label className="text-xs">L</Label>
                     <Input type="number" disabled={isReadOnly} value={formData.lectureCredits ?? 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-xs">T</Label>
                     <Input type="number" disabled={isReadOnly} value={formData.tutorialCredits ?? 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-xs">P</Label>
                     <Input type="number" disabled={isReadOnly} value={formData.practicalCredits ?? 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
                   </div>
                   <div className="space-y-2">
                     <Label className="text-xs font-bold text-primary">Total Credits</Label>
                     <Input value={formData.credits ?? 0} className="font-bold bg-primary/5" readOnly />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Select disabled={isReadOnly} value={String(formData.semester)} onValueChange={v => setFormData({ ...formData, semester: Number(v) })}>
                    <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5,6,7,8].map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select disabled={isReadOnly} value={formData.creditCategory} onValueChange={(v: any) => setFormData({...formData, creditCategory: v})}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DSC">DSC (Core)</SelectItem>
                      <SelectItem value="DSE">DSE (Elective)</SelectItem>
                      <SelectItem value="OFE">OFE (Open Elective)</SelectItem>
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
              </TabsContent>
              
              <TabsContent value="syllabus" className="space-y-4">
                 <div className="flex justify-between items-center mb-4">
                   <h3 className="font-bold">Course Units</h3>
                   {!isReadOnly && <Button size="sm" onClick={() => setFormData(prev => ({...prev, units: [...(prev.units || []), {id: Math.random().toString(36).substr(2, 9), title: '', content: '', courseOutcome: ''}]}))}><Plus className="w-4 h-4" /> Add Unit</Button>}
                 </div>
                 {formData.units?.map((unit, idx) => (
                   <Card key={unit.id} className="bg-muted/10">
                     <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between font-bold text-xs uppercase text-muted-foreground">Unit {idx+1} <Button variant="ghost" size="icon" onClick={() => setFormData(prev => ({...prev, units: prev.units?.filter(u => u.id !== unit.id)}))}><Trash2 className="w-3 h-3"/></Button></div>
                        <Input disabled={isReadOnly} placeholder="Title" value={unit.title} onChange={e => {
                          const u = [...(formData.units || [])]; u[idx].title = e.target.value; setFormData({...formData, units: u});
                        }} />
                        <Textarea disabled={isReadOnly} placeholder="Topics" value={unit.content} onChange={e => {
                          const u = [...(formData.units || [])]; u[idx].content = e.target.value; setFormData({...formData, units: u});
                        }} />
                        <Input disabled={isReadOnly} placeholder="Course Outcome" value={unit.courseOutcome} onChange={e => {
                          const u = [...(formData.units || [])]; u[idx].courseOutcome = e.target.value; setFormData({...formData, units: u});
                        }} />
                     </CardContent>
                   </Card>
                 ))}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!isReadOnly && <Button disabled={isCheckingGlobal || !!globalConflict} onClick={handleSave}>Save Subject</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
