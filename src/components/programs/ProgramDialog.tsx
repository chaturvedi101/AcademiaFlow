
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Program, CreditRules } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { X, Plus } from 'lucide-react';

interface ProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: Program;
}

const DEFAULT_RULES: CreditRules = {
  dscMin: 96,
  dscMax: 104,
  experientialMin: 8,
  experientialMax: 12,
  dseMin: 12,
  dseMax: 16,
  ofeMin: 12,
  ofeMax: 16,
  totalRequired: 160
};

export function ProgramDialog({ open, onOpenChange, program }: ProgramDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [newBranch, setNewBranch] = useState('');
  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    code: '',
    description: '',
    level: 'UG',
    totalSemesters: 8,
    branches: [],
    rules: { ...DEFAULT_RULES }
  });

  useEffect(() => {
    if (program) {
      setFormData({
        ...program,
        branches: program.branches || []
      });
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        level: 'UG',
        totalSemesters: 8,
        branches: [],
        rules: { ...DEFAULT_RULES }
      });
    }
  }, [program, open]);

  const handleSave = () => {
    if (!formData.code) {
      toast({ title: "Validation Error", description: "Program code is required.", variant: "destructive" });
      return;
    }

    const programId = program?.id || formData.code.toLowerCase().replace(/\s+/g, '-') || Math.random().toString(36).substr(2, 9);
    const programRef = doc(db, 'programs', programId);
    
    const data = {
      ...formData,
      totalSemesters: Number(formData.totalSemesters || 0),
      updatedAt: serverTimestamp(),
      createdAt: program?.createdAt || serverTimestamp(),
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
    if (!newBranch.trim()) return;
    if (formData.branches?.includes(newBranch.trim())) return;
    setFormData(prev => ({
      ...prev,
      branches: [...(prev.branches || []), newBranch.trim()]
    }));
    setNewBranch('');
  };

  const removeBranch = (branch: string) => {
    setFormData(prev => ({
      ...prev,
      branches: prev.branches?.filter(b => b !== branch)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-20">
          <DialogTitle className="font-headline text-2xl">
            {program ? 'Edit Program' : 'New Program Definition'}
          </DialogTitle>
          <DialogDescription>
            Configure program details, branches, semesters, and credit limits.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full outline-none" tabIndex={0}>
          <div className="p-6 space-y-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Program Name</Label>
                <Input 
                  placeholder="B.Tech in Engineering" 
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Program Code</Label>
                <Input 
                  placeholder="BTECH" 
                  value={formData.code || ''}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold">Program Branches / Specializations</Label>
              <div className="flex gap-2">
                <Input 
                  placeholder="e.g. Computer Science, Mechanical..." 
                  value={newBranch}
                  onChange={e => setNewBranch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addBranch()}
                  className="h-11"
                />
                <Button type="button" onClick={addBranch} variant="secondary" className="h-11">
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.branches?.map(branch => (
                  <Badge key={branch} variant="secondary" className="pl-3 pr-1 py-1 gap-1">
                    {branch}
                    <Button variant="ghost" size="icon" className="h-4 w-4 p-0 hover:bg-transparent" onClick={() => removeBranch(branch)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Level</Label>
                <Select value={formData.level || 'UG'} onValueChange={(v: any) => setFormData({ ...formData, level: v })}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UG">Undergraduate (UG)</SelectItem>
                    <SelectItem value="PG">Postgraduate (PG)</SelectItem>
                    <SelectItem value="Diploma">Diploma</SelectItem>
                    <SelectItem value="Certificate">Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Total Semesters</Label>
                <Input 
                  type="number" 
                  placeholder="8"
                  value={formData.totalSemesters ?? ''}
                  onChange={e => setFormData({ ...formData, totalSemesters: parseInt(e.target.value) || 0 })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Total Required Credits</Label>
                <Input 
                  type="number" 
                  placeholder="160"
                  value={formData.rules?.totalRequired ?? ''} 
                  onChange={e => updateRule('totalRequired', e.target.value)}
                  className="h-11 font-bold border-primary/20 bg-primary/5 focus:bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Description</Label>
              <Textarea 
                placeholder="Brief overview of the program objectives..."
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px] resize-none"
              />
            </div>

            <div className="border-t pt-6 space-y-6">
              <div className="flex flex-col gap-1">
                <h3 className="font-headline font-bold text-lg text-primary">NEP 2020 Credit Framework</h3>
                <p className="text-xs text-muted-foreground">Define minimum and maximum boundaries for each credit category.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-4">
                    <Label className="text-primary font-bold text-sm block border-b pb-2 uppercase tracking-wide">DSC (Core)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Min</Label>
                        <Input type="number" value={formData.rules?.dscMin ?? ''} onChange={e => updateRule('dscMin', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Max</Label>
                        <Input type="number" value={formData.rules?.dscMax ?? ''} onChange={e => updateRule('dscMax', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-4">
                    <Label className="text-primary font-bold text-sm block border-b pb-2 uppercase tracking-wide">DSE (Elective)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Min</Label>
                        <Input type="number" value={formData.rules?.dseMin ?? ''} onChange={e => updateRule('dseMin', e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold">Max</Label>
                        <Input type="number" value={formData.rules?.dseMax ?? ''} onChange={e => updateRule('dseMax', e.target.value)} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/20 border-t shrink-0 z-20">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="px-6">Cancel</Button>
          <Button onClick={handleSave} className="px-8 shadow-lg">Save Program Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
