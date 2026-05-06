
"use client";

import { useState, useEffect } from "react";
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
import { Calculator, Info, Plus, Trash2, Sparkles, Loader2, Wand2, AlertCircle } from "lucide-react";
import { Syllabus, CorrelationLevel, SyllabusUnit } from "@/lib/types";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { suggestCOPOMapping } from "@/ai/flows/suggest-co-po-mapping";
import { useToast } from "@/hooks/use-toast";

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

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  onSave: (data: Partial<Syllabus>) => void;
}

export function SyllabusDialog({ open, onOpenChange, syllabus, onSave }: SyllabusDialogProps) {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMapping, setIsMapping] = useState(false);
  const [unitCount, setUnitCount] = useState(5);
  const [apiKeyError, setApiKeyError] = useState(false);
  
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
  });

  useEffect(() => {
    if (syllabus) {
      setFormData(prev => ({
        ...prev,
        ...syllabus,
        units: syllabus.units || [],
        poMappings: syllabus.poMappings || {},
      }));
    }
  }, [syllabus, open]);

  useEffect(() => {
    const l = Number(formData.lectureCredits) || 0;
    const t = Number(formData.tutorialCredits) || 0;
    const p = Number(formData.practicalCredits) || 0;
    const calculated = l + t + (p * 0.5);
    setFormData(prev => ({ ...prev, credits: calculated }));
  }, [formData.lectureCredits, formData.tutorialCredits, formData.practicalCredits]);

  const handleAIGenerate = async () => {
    if (!formData.title) {
      toast({ title: "Title Required", description: "Please enter a subject title first.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setApiKeyError(false);
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
        creditCategory: (result.suggestedCategory as any) || prev.creditCategory,
      }));

      toast({ title: "Syllabus Drafted", description: `AI generated ${newUnits.length} units based on subject standards.` });
    } catch (error: any) {
      const isAuthError = error.message?.includes('API_KEY') || error.message?.includes('400') || error.message?.includes('expired');
      if (isAuthError) setApiKeyError(true);
      
      toast({ 
        title: isAuthError ? "API Key Expired" : "Generation Failed", 
        description: isAuthError 
          ? "Your Google AI API key is missing or expired. Please update it in the system settings." 
          : error.message || "Could not reach AI services.", 
        variant: "destructive" 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIMap = async () => {
    if (!formData.units || formData.units.length === 0) {
      toast({ title: "Units Required", description: "Define syllabus units before mapping CO-POs.", variant: "destructive" });
      return;
    }

    setIsMapping(true);
    try {
      const result = await suggestCOPOMapping({
        subjectTitle: formData.title || 'Unknown Subject',
        units: formData.units.map(u => ({ id: u.id, courseOutcome: u.courseOutcome })),
      });

      setFormData(prev => ({
        ...prev,
        poMappings: result.mappings as any,
      }));

      toast({ title: "Mapping Suggested", description: "AI has filled the correlation matrix based on CO statements." });
    } catch (error: any) {
      toast({ title: "Mapping Failed", description: "Could not generate suggestions. Check your API key.", variant: "destructive" });
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
    setFormData(prev => ({
      ...prev,
      units: [...(prev.units || []), newUnit]
    }));
  };

  const removeUnit = (id: string) => {
    setFormData(prev => ({
      ...prev,
      units: prev.units?.filter(u => u.id !== id),
      poMappings: prev.poMappings ? Object.fromEntries(
        Object.entries(prev.poMappings).filter(([k]) => k !== id)
      ) : {}
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background">
          <DialogTitle className="font-headline text-2xl flex items-center gap-2">
            {syllabus?.id ? 'Edit Subject Details' : 'Add New Subject Definition'}
            {!syllabus?.id && <Badge className="bg-primary/10 text-primary border-none">AI-Enabled</Badge>}
          </DialogTitle>
          <DialogDescription>
            Configure credits, semester, unit content, and CO-PO mapping matrix.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-8">
            {apiKeyError && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 text-red-800 text-sm">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <div>
                    <p className="font-bold">Google AI API Key Required</p>
                    <p className="text-xs opacity-90">Your current API key has expired or is invalid. Please update your environment variables to continue using AI tools.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="bg-white text-red-600 border-red-200 hover:bg-red-50" asChild>
                  <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">Get New Key</a>
                </Button>
              </div>
            )}

            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-8">
                <TabsTrigger value="basic">Basic Information</TabsTrigger>
                <TabsTrigger value="syllabus">Unit Syllabus & COs</TabsTrigger>
                <TabsTrigger value="mapping">CO-PO Mapping Matrix</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Code</Label>
                    <Input 
                      placeholder="e.g., CSE302" 
                      value={formData.subjectCode || ''} 
                      onChange={e => setFormData({ ...formData, subjectCode: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Subject Title</Label>
                    <Input 
                      placeholder="e.g., Analysis of Algorithms" 
                      className="flex-1"
                      value={formData.title || ''}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
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
                        <Input type="number" value={formData.lectureCredits ?? 0} onChange={e => setFormData({...formData, lectureCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">T</Label>
                        <Input type="number" value={formData.tutorialCredits ?? 0} onChange={e => setFormData({...formData, tutorialCredits: Number(e.target.value)})} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase">P</Label>
                        <Input type="number" value={formData.practicalCredits ?? 0} onChange={e => setFormData({...formData, practicalCredits: Number(e.target.value)})} />
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
                        <SelectTrigger className="bg-white flex-1"><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DSC">DSC (Core)</SelectItem>
                          <SelectItem value="DSE">DSE (Elective)</SelectItem>
                          <SelectItem value="OFE">OFE (Open Elective)</SelectItem>
                          <SelectItem value="VAC">VAC (Value Added)</SelectItem>
                          <SelectItem value="SEC">SEC (Skill)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="syllabus" className="space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <div className="space-y-1">
                    <h3 className="font-headline font-bold text-primary">Unit Configuration</h3>
                    <p className="text-xs text-muted-foreground">Draft syllabus using AI or add units manually.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 border rounded-lg px-2 bg-white">
                       <span className="text-[10px] font-bold text-muted-foreground uppercase">AI Units:</span>
                       <Select value={String(unitCount)} onValueChange={v => setUnitCount(Number(v))}>
                         <SelectTrigger className="h-8 w-14 border-none shadow-none focus:ring-0">
                           <SelectValue />
                         </SelectTrigger>
                         <SelectContent>
                           {[1,2,3,4,5,6,7,8,9,10].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                         </SelectContent>
                       </Select>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleAIGenerate} 
                      disabled={isGenerating}
                      className="gap-2 bg-primary text-white hover:bg-primary/90 hover:text-white"
                    >
                      {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      Syllabus Architect
                    </Button>
                    <Button variant="outline" size="sm" onClick={addManualUnit} className="gap-2">
                      <Plus className="w-4 h-4" /> Add Manual Unit
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  {formData.units?.map((unit, index) => (
                    <Card key={unit.id} className="border-none shadow-sm bg-muted/10">
                      <div className="bg-primary/5 px-4 py-2 border-b flex items-center justify-between">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase">UNIT {index + 1}</Badge>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-50" onClick={() => removeUnit(unit.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Unit Title</Label>
                            <Input value={unit.title} onChange={e => updateUnit(index, 'title', e.target.value)} className="bg-white" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-primary">Course Outcome (CO)</Label>
                            <Input value={unit.courseOutcome} onChange={e => updateUnit(index, 'courseOutcome', e.target.value)} className="bg-primary/5 border-primary/20 focus:bg-white" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] uppercase font-bold text-muted-foreground">Syllabus Content</Label>
                          <Textarea value={unit.content} onChange={e => updateUnit(index, 'content', e.target.value)} className="min-h-[100px] bg-white" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="mapping" className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-800 text-sm">
                  <div className="flex gap-3">
                    <Info className="w-5 h-5 shrink-0" />
                    <p>Map unit outcomes against Program Outcomes to establish the correlation matrix.</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-2 bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200"
                    onClick={handleAIMap}
                    disabled={isMapping || !formData.units?.length}
                  >
                    {isMapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Smart Mapping Suggestions
                  </Button>
                </div>

                <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="w-[200px] font-bold">Course Outcomes</TableHead>
                        {PO_DEFINITIONS.map(po => (
                          <TableHead key={po.code} className="p-0 text-center w-[60px]">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="cursor-help py-3 px-1 font-bold text-primary hover:bg-primary/5 uppercase text-[10px]">
                                    {po.code}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="font-bold">{po.code}: {po.title}</p>
                                  <p className="text-xs max-w-[200px]">{po.desc}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.units?.map((unit, uIdx) => (
                        <TableRow key={unit.id} className="hover:bg-muted/5">
                          <TableCell className="font-medium text-xs align-top pt-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-primary">CO{uIdx + 1}</span>
                                <span className="text-[10px] text-muted-foreground line-clamp-2 italic">{unit.courseOutcome || 'No CO defined'}</span>
                              </div>
                            </div>
                          </TableCell>
                          {PO_DEFINITIONS.map(po => (
                            <TableCell key={po.code} className="p-1 text-center border-l">
                              <Select 
                                value={formData.poMappings?.[unit.id]?.[po.code] || '-'} 
                                onValueChange={(val: CorrelationLevel) => updatePOMapping(unit.id, po.code, val)}
                              >
                                <SelectTrigger className="h-9 w-12 mx-auto border-none bg-transparent hover:bg-muted focus:ring-0">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="min-w-[60px]">
                                  {CORRELATION_LEVELS.map(lvl => (
                                    <SelectItem key={lvl} value={lvl}>{lvl}</SelectItem>
                                  ))}
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

        <DialogFooter className="p-6 bg-muted/20 border-t z-20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6 h-11">Cancel</Button>
          <Button onClick={() => { onSave(formData); onOpenChange(false); }} className="px-8 h-11 shadow-lg">Save Subject Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
