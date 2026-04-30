
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
        ...(prev.rules as CreditRules),
        [key]: numValue
      }
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="font-headline text-2xl">
            {program ? 'Edit Program' : 'New Program Definition'}
          </DialogTitle>
          <DialogDescription>
            Configure program details, semesters, and credit limits for NEP 2020 compliance.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Program Name</Label>
                <Input 
                  placeholder="B.Tech in Computer Science" 
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Program Code</Label>
                <Input 
                  placeholder="BTECH-CS" 
                  value={formData.code || ''}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Level</Label>
                <Select value={formData.level || 'UG'} onValueChange={(v: any) => setFormData({ ...formData, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UG">Undergraduate (UG)</SelectItem>
                    <SelectItem value="PG">Postgraduate (PG)</SelectItem>
                    <SelectItem value="Diploma">Diploma</SelectItem>
                    <SelectItem value="Certificate">Certificate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Semesters</Label>
                <Input 
                  type="number" 
                  placeholder="8"
                  value={formData.totalSemesters || ''}
                  onChange={e => setFormData({ ...formData, totalSemesters: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total Required Credits</Label>
                <Input 
                  type="number" 
                  value={formData.rules?.totalRequired || ''} 
                  onChange={e => updateRule('totalRequired', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Brief overview of the program objectives..."
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-headline font-bold text-lg">Credit Framework (Min / Max Limits)</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">DSC Min</Label>
                      <Input type="number" value={formData.rules?.dscMin || ''} onChange={e => updateRule('dscMin', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">DSC Max</Label>
                      <Input type="number" value={formData.rules?.dscMax || ''} onChange={e => updateRule('dscMax', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Experiential Min</Label>
                      <Input type="number" value={formData.rules?.experientialMin || ''} onChange={e => updateRule('experientialMin', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Experiential Max</Label>
                      <Input type="number" value={formData.rules?.experientialMax || ''} onChange={e => updateRule('experientialMax', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">DSE Min</Label>
                      <Input type="number" value={formData.rules?.dseMin || ''} onChange={e => updateRule('dseMin', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">DSE Max</Label>
                      <Input type="number" value={formData.rules?.dseMax || ''} onChange={e => updateRule('dseMax', e.target.value)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">OFE Min</Label>
                      <Input type="number" value={formData.rules?.ofeMin || ''} onChange={e => updateRule('ofeMin', e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">OFE Max</Label>
                      <Input type="number" value={formData.rules?.ofeMax || ''} onChange={e => updateRule('ofeMax', e.target.value)} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/20 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Program</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
