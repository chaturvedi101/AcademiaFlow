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
import { Sparkles, Plus, X, Calculator, Loader2, BookOpen, Layers } from "lucide-react";
import { suggestProgramOutcomes } from "@/ai/flows/suggest-program-outcomes";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { Syllabus, CreditCategory, SubjectType, SyllabusUnit } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  onSave: (data: Partial<Syllabus>) => void;
}

export function SyllabusDialog({ open, onOpenChange, syllabus, onSave }: SyllabusDialogProps) {
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
    programOutcomes: [],
  });
  
  const [loadingAI, setLoadingAI] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (syllabus) {
      setFormData(prev => ({
        ...prev,
        ...syllabus,
        lectureCredits: syllabus.lectureCredits || 0,
        tutorialCredits: syllabus.tutorialCredits || 0,
        practicalCredits: syllabus.practicalCredits || 0,
        credits: syllabus.credits || 0,
        units: syllabus.units || [],
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

  const handleAIContent = async () => {
    if (!formData.title) {
      toast({ title: "Validation Error", description: "Subject title is required for AI generation.", variant: "destructive" });
      return;
    }
    setLoadingAI(true);
    try {
      const result = await generateSyllabusContent({ 
        subjectTitle: formData.title, 
        keywords: [formData.subjectCode || ''] 
      });
      
      const newUnits = result.units.map(u => ({
        id: Math.random().toString(36).substr(2, 9),
        title: u.title,
        content: u.content,
        courseOutcome: u.courseOutcome
      }));

      setFormData(prev => ({
        ...prev,
        units: newUnits,
        courseOutcomes: result.units.map(u => u.courseOutcome)
      }));

      toast({ title: "AI Generation Success", description: "Syllabus units and outcomes populated." });
    } catch (e: any) {
      const message = e.message || "Could not generate content.";
      const isRateLimit = message.toLowerCase().includes("resource exhausted") || message.includes("429") || message.toLowerCase().includes("quota");
      
      toast({ 
        title: isRateLimit ? "AI Service Busy" : "AI Generation Error", 
        description: isRateLimit ? "The AI is currently at capacity. Please wait 10-20 seconds and try again." : message, 
        variant: "destructive" 
      });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleNumUnitsChange = (val: string) => {
    const count = parseInt(val) || 0;
    const currentUnits = [...(formData.units || [])];
    
    if (count > currentUnits.length) {
      const additional = Array.from({ length: count - currentUnits.length }, (_, i) => ({
        id: Math.random().toString(36).substr(2, 9),
        title: `Unit ${currentUnits.length + i + 1}`,
        content: '',
        courseOutcome: ''
      }));
      updateField('units', [...currentUnits, ...additional]);
    } else {
      updateField('units', currentUnits.slice(0, count));
    }
  };

  const updateUnit = (index: number, field: keyof SyllabusUnit, value: string) => {
    const newUnits = [...(formData.units || [])];
    newUnits[index] = { ...newUnits[index], [field]: value };
    updateField('units', newUnits);
  };

  const updateField = (field: keyof Syllabus, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-20">
          <DialogTitle className="font-headline text-2xl">
            {syllabus?.id ? 'Edit Subject Details' : 'Add New Subject Definition'}
          </DialogTitle>
          <DialogDescription>
            Configure credits, semester, and unit-wise syllabus content with outcomes.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 outline-none" tabIndex={0}>
          <div className="p-6 space-y-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Subject Code</Label>
                <Input 
                  placeholder="e.g., CSE302" 
                  value={formData.subjectCode || ''} 
                  onChange={e => updateField('subjectCode', e.target.value)}
                  className="h-11 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Subject Title</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="e.g., Analysis of Algorithms" 
                    className="h-11 flex-1"
                    value={formData.title || ''}
                    onChange={e => updateField('title', e.target.value)}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="h-11 w-11 shrink-0 text-accent border-accent/20 hover:bg-accent/10"
                    onClick={handleAIContent}
                    disabled={loadingAI}
                    title="Generate Syllabus using AI"
                  >
                    {loadingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="p-5 bg-muted/30 rounded-2xl border border-border/50 space-y-6 lg:col-span-2">
                <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider border-b pb-3">
                  <Calculator className="w-4 h-4" />
                  Credit Structure (L-T-P)
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Lecture (L)</Label>
                    <Input 
                      type="number" 
                      value={formData.lectureCredits ?? 0} 
                      onChange={e => updateField('lectureCredits', Number(e.target.value))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Tutorial (T)</Label>
                    <Input 
                      type="number" 
                      value={formData.tutorialCredits ?? 0} 
                      onChange={e => updateField('tutorialCredits', Number(e.target.value))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase">Practical (P)</Label>
                    <Input 
                      type="number" 
                      value={formData.practicalCredits ?? 0} 
                      onChange={e => updateField('practicalCredits', Number(e.target.value))}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-primary uppercase">Total Credits</Label>
                    <Input 
                      type="number" 
                      value={formData.credits ?? 0} 
                      onChange={e => updateField('credits', Number(e.target.value))}
                      className="h-11 font-bold bg-primary/5 border-primary/20 text-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 bg-accent/5 rounded-2xl border border-accent/10 space-y-4">
                <div className="flex items-center gap-2 text-accent font-bold text-sm uppercase tracking-wider border-b border-accent/10 pb-3">
                  <Layers className="w-4 h-4" />
                  Unit Configuration
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Number of Units</Label>
                  <Select 
                    value={String(formData.units?.length || 0)} 
                    onValueChange={handleNumUnitsChange}
                  >
                    <SelectTrigger className="h-11 bg-white">
                      <SelectValue placeholder="Select unit count..." />
                    </SelectTrigger>
                    <SelectContent>
                      {[0,1,2,3,4,5,6,7,8].map(n => (
                        <SelectItem key={n} value={String(n)}>{n} Units</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    Increasing units adds placeholders; decreasing removes data. AI usually generates 5 units.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Semester</Label>
                <Select 
                  value={String(formData.semester)} 
                  onValueChange={val => updateField('semester', Number(val))}
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8,9,10].map(s => (
                      <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Subject Type</Label>
                <Select 
                  value={formData.type || 'Theory'} 
                  onValueChange={val => updateField('type', val as SubjectType)}
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Theory">Theory</SelectItem>
                    <SelectItem value="Practical/Lab">Practical/Lab</SelectItem>
                    <SelectItem value="Tutorial">Tutorial</SelectItem>
                    <SelectItem value="Skill/IKS/Experiential">Skill/IKS/Experiential</SelectItem>
                    <SelectItem value="Sessional">Sessional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Credit Category</Label>
                <Select 
                  value={formData.creditCategory || 'DSC'} 
                  onValueChange={val => updateField('creditCategory', val as CreditCategory)}
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DSC">DSC (Core)</SelectItem>
                    <SelectItem value="DSE">DSE (Elective)</SelectItem>
                    <SelectItem value="OFE">OFE (Open Elective)</SelectItem>
                    <SelectItem value="CPF">CPF (Common Pool)</SelectItem>
                    <SelectItem value="VAC">VAC (Value Added)</SelectItem>
                    <SelectItem value="AEC">AEC (Ability Enhancement)</SelectItem>
                    <SelectItem value="SEC">SEC (Skill Enhancement)</SelectItem>
                    <SelectItem value="MDC">MDC (Multidisciplinary)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-6 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-headline font-bold text-xl text-primary">Syllabus Content & Outcomes</h3>
                  <p className="text-sm text-muted-foreground">Define unit titles, syllabus details, and unit-specific COs.</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleAIContent} 
                  disabled={loadingAI}
                  className="text-xs h-9 text-accent hover:bg-accent/10 gap-1.5 shadow-sm"
                >
                  {loadingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Generate Full Syllabus
                </Button>
              </div>

              <div className="space-y-6">
                {formData.units?.map((unit, index) => (
                  <Card key={unit.id} className="border-none shadow-sm bg-muted/10 overflow-hidden">
                    <div className="bg-primary/5 px-4 py-2 border-b border-primary/10 flex items-center justify-between">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-none text-[10px] font-bold">
                        UNIT {index + 1}
                      </Badge>
                    </div>
                    <CardContent className="p-4 space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">Unit Title</Label>
                          <Input 
                            value={unit.title} 
                            onChange={e => updateUnit(index, 'title', e.target.value)}
                            placeholder="e.g., Introduction to Neural Networks"
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-primary uppercase">Course Outcome (CO)</Label>
                          <Input 
                            value={unit.courseOutcome} 
                            onChange={e => updateUnit(index, 'courseOutcome', e.target.value)}
                            placeholder="e.g., Apply gradient descent for training..."
                            className="bg-primary/5 border-primary/20 focus:bg-white"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-2">
                          <BookOpen className="w-3 h-3" />
                          Syllabus Content
                        </Label>
                        <Textarea 
                          value={unit.content} 
                          onChange={e => updateUnit(index, 'content', e.target.value)}
                          placeholder="List of topics, modules, and sub-topics..."
                          className="min-h-[120px] bg-white resize-none"
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {(!formData.units || formData.units.length === 0) && (
                  <div className="text-center py-16 border-2 border-dashed rounded-3xl bg-muted/5">
                    <Layers className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                    <p className="text-muted-foreground font-medium">No units defined. Select unit count above to begin.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-base font-bold text-primary">Program Outcomes Mapping (PO)</Label>
              <div className="flex flex-wrap gap-2">
                {formData.programOutcomes?.map((po, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1.5 bg-accent/10 text-accent border-accent/20 font-medium">
                    {po}
                    <X className="w-3.5 h-3.5 ml-2 cursor-pointer hover:text-primary" onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        programOutcomes: prev.programOutcomes?.filter((_, i) => i !== idx)
                      }));
                    }} />
                  </Badge>
                ))}
                <Button variant="outline" size="sm" className="rounded-full text-xs h-8 border-dashed">
                  <Plus className="w-3.5 h-3.5 mr-1.5" /> Map PO
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-accent" />
                AI-driven PO mapping helps track degree compliance across the university.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/20 border-t shrink-0 z-20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6 h-11">Cancel</Button>
          <Button onClick={() => {
            onSave(formData);
            onOpenChange(false);
          }} className="px-8 h-11 shadow-lg">Save Subject Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
