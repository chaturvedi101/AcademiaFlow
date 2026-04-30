'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useFirestore } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Program, CreditRules } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    code: '',
    description: '',
    level: 'UG',
    totalSemesters: 8,
    rules: { ...DEFAULT_RULES }
  });

  useEffect(() => {
    if (program) {
      setFormData(program);
    } else {
      setFormData({
        name: '',
        code: '',
        description: '',
        level: 'UG',
        totalSemesters: 8,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-20">
          <DialogTitle className="font-headline text-2xl">
            {program ? 'Edit Program' : 'New Program Definition'}
          </DialogTitle>
          <DialogDescription>
            Configure program details, semesters, and credit limits for NEP 2020 compliance.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full outline-none" tabIndex={0}>
          <div className="p-6 space-y-8 pb-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Program Name</Label>
                <Input 
                  placeholder="B.Tech in Computer Science" 
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Program Code</Label>
                <Input 
                  placeholder="BTECH-CS" 
                  value={formData.code || ''}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="h-11"
                />
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
                    <Label className="text-primary font-bold text-sm block border-b pb-2 uppercase tracking-wide">Discipline Specific Core (DSC)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Min Credits</Label>
                        <Input type="number" value={formData.rules?.dscMin ?? ''} onChange={e => updateRule('dscMin', e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Max Credits</Label>
                        <Input type="number" value={formData.rules?.dscMax ?? ''} onChange={e => updateRule('dscMax', e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-4">
                    <Label className="text-primary font-bold text-sm block border-b pb-2 uppercase tracking-wide">Experiential Learning</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Min Credits</Label>
                        <Input type="number" value={formData.rules?.experientialMin ?? ''} onChange={e => updateRule('experientialMin', e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Max Credits</Label>
                        <Input type="number" value={formData.rules?.experientialMax ?? ''} onChange={e => updateRule('experientialMax', e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="p-4 bg-muted/30 rounded-xl border border-border/50 space-y-4">
                    <Label className="text-primary font-bold text-sm block border-b pb-2 uppercase tracking-wide">Discipline Specific Elective (DSE)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Min Credits</Label>
                        <Input type="number" value={formData.rules?.dseMin ?? ''} onChange={e => updateRule('dseMin', e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">Max Credits</Label>
                        <Input type="number" value={formData.rules?.dseMax ?? ''} onChange={e => updateRule('dseMax', e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl space-y-4">
                    <Label className="text-accent font-bold text-sm block border-b border-accent/10 pb-2 uppercase tracking-wide">Open / Free Electives (OFE)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-accent/60 font-bold tracking-wider">Min Credits</Label>
                        <Input type="number" value={formData.rules?.ofeMin ?? ''} onChange={e => updateRule('ofeMin', e.target.value)} className="h-9 border-accent/20 focus:ring-accent/20" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] uppercase text-accent/60 font-bold tracking-wider">Max Credits</Label>
                        <Input type="number" value={formData.rules?.ofeMax ?? ''} onChange={e => updateRule('ofeMax', e.target.value)} className="h-9 border-accent/20 focus:ring-accent/20" />
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