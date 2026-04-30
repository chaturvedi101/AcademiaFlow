"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Plus, X } from "lucide-react";
import { suggestProgramOutcomes } from "@/ai/flows/suggest-program-outcomes";
import { generateSyllabusContent } from "@/ai/flows/generate-syllabus-content";
import { Syllabus, CreditCategory, SubjectType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

interface SyllabusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  syllabus?: Partial<Syllabus>;
  onSave: (data: Partial<Syllabus>) => void;
}

export function SyllabusDialog({ open, onOpenChange, syllabus, onSave }: SyllabusDialogProps) {
  const [formData, setFormData] = useState<Partial<Syllabus>>(syllabus || {
    subjectCode: '',
    title: '',
    credits: 0,
    semester: 1,
    type: 'Theory',
    creditCategory: 'DSC',
    courseOutcomes: [],
    programOutcomes: [],
  });
  const [newCO, setNewCO] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const { toast } = useToast();

  const handleAIContent = async () => {
    if (!formData.title) return;
    setLoadingAI(true);
    try {
      const result = await generateSyllabusContent({ 
        subjectTitle: formData.title, 
        keywords: [formData.subjectCode || ''] 
      });
      setFormData(prev => ({
        ...prev,
        courseOutcomes: result.courseOutcomes
      }));
      toast({ title: "AI Generation Success", description: "Syllabus content populated." });
    } catch (e) {
      toast({ title: "AI Error", description: "Could not generate content.", variant: "destructive" });
    } finally {
      setLoadingAI(false);
    }
  };

  const handleAISuggestPO = async (coText: string) => {
    try {
      const result = await suggestProgramOutcomes({ courseOutcome: coText });
      setFormData(prev => ({
        ...prev,
        programOutcomes: Array.from(new Set([...(prev.programOutcomes || []), ...result.suggestedProgramOutcomes]))
      }));
    } catch (e) {
      toast({ title: "AI Error", description: "Failed to suggest POs", variant: "destructive" });
    }
  };

  const addCO = () => {
    if (!newCO.trim()) return;
    const co = newCO.trim();
    setFormData(prev => ({
      ...prev,
      courseOutcomes: [...(prev.courseOutcomes || []), co]
    }));
    setNewCO("");
    handleAISuggestPO(co);
  };

  const removeCO = (index: number) => {
    setFormData(prev => ({
      ...prev,
      courseOutcomes: prev.courseOutcomes?.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-headline text-2xl">
            {syllabus?.id ? 'Edit Subject' : 'Add New Subject'}
          </DialogTitle>
          <DialogDescription>
            Enter details for the academic syllabus. Use AI to assist with outcomes.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subject Code</Label>
                <Input 
                  placeholder="CS101" 
                  value={formData.subjectCode} 
                  onChange={e => setFormData({...formData, subjectCode: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Subject Title</Label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Data Structures" 
                    className="flex-1"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="icon" 
                    className="shrink-0 text-accent border-accent/20 hover:bg-accent/10"
                    onClick={handleAIContent}
                    disabled={loadingAI}
                  >
                    <Sparkles className={`w-4 h-4 ${loadingAI ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Credits</Label>
                <Input 
                  type="number" 
                  value={formData.credits} 
                  onChange={e => setFormData({...formData, credits: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <Label>Semester</Label>
                <Select 
                  value={String(formData.semester)} 
                  onValueChange={val => setFormData({...formData, semester: parseInt(val)})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5,6,7,8].map(s => (
                      <SelectItem key={s} value={String(s)}>Sem {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={val => setFormData({...formData, type: val as SubjectType})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Theory">Theory</SelectItem>
                    <SelectItem value="Practical/Lab">Practical/Lab</SelectItem>
                    <SelectItem value="Tutorial">Tutorial</SelectItem>
                    <SelectItem value="Skill/IKS/Experiential">Skill/IKS/Experiential</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select 
                  value={formData.creditCategory} 
                  onValueChange={val => setFormData({...formData, creditCategory: val as CreditCategory})}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DSC">DSC (Core)</SelectItem>
                    <SelectItem value="DSE">DSE (Elective)</SelectItem>
                    <SelectItem value="OFE">OFE (Open Elective)</SelectItem>
                    <SelectItem value="CPF">CPF (Common Pool)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Course Outcomes (CO)</Label>
                <Button variant="ghost" size="sm" onClick={handleAIContent} className="text-xs h-7 text-accent">
                  <Sparkles className="w-3 h-3 mr-1" /> Auto-generate COs
                </Button>
              </div>
              <div className="space-y-3">
                {formData.courseOutcomes?.map((co, idx) => (
                  <div key={idx} className="flex gap-2 items-start p-3 bg-muted/30 rounded-lg border group relative">
                    <span className="text-xs font-bold text-primary pt-0.5">CO{idx+1}</span>
                    <p className="text-sm flex-1 leading-relaxed">{co}</p>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeCO(idx)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Textarea 
                    placeholder="Describe a learning outcome..." 
                    className="min-h-[60px]"
                    value={newCO}
                    onChange={e => setNewCO(e.target.value)}
                  />
                  <Button variant="outline" className="h-auto" onClick={addCO}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-semibold">Program Outcomes Mapping (PO)</Label>
              <div className="flex flex-wrap gap-2">
                {formData.programOutcomes?.map((po, idx) => (
                  <Badge key={idx} variant="secondary" className="px-3 py-1 bg-accent/10 text-accent border-accent/20">
                    {po}
                    <X className="w-3 h-3 ml-2 cursor-pointer" onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        programOutcomes: prev.programOutcomes?.filter((_, i) => i !== idx)
                      }));
                    }} />
                  </Badge>
                ))}
                <Button variant="outline" size="sm" className="rounded-full text-xs h-7">
                  <Plus className="w-3 h-3 mr-1" /> Add PO
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 italic">
                POs are automatically suggested by AI based on your Course Outcomes.
              </p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/20 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => {
            onSave(formData);
            onOpenChange(false);
          }}>Save Subject</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
