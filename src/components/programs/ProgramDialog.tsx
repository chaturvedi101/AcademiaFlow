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
import { Program, CreditRules, FACULTIES, UserProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { X, Plus, Hash } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ProgramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program?: Program;
  userProfile?: UserProfile;
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

export function ProgramDialog({ open, onOpenChange, program, userProfile }: ProgramDialogProps) {
  const db = useFirestore();
  const { toast } = useToast();
  const [newBranch, setNewBranch] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  
  const initialFaculty = userProfile?.role === 'dean_faculty' ? userProfile.faculty : FACULTIES[0];

  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    code: '',
    faculty: initialFaculty,
    description: '',
    level: 'UG',
    totalSemesters: 8,
    branches: [],
    branchPrefixes: {},
    rules: { ...DEFAULT_RULES }
  });

  useEffect(() => {
    if (program) {
      setFormData({
        ...program,
        branches: program.branches || [],
        branchPrefixes: program.branchPrefixes || {}
      });
    } else {
      setFormData({
        name: '',
        code: '',
        faculty: initialFaculty,
        description: '',
        level: 'UG',
        totalSemesters: 8,
        branches: [],
        branchPrefixes: {},
        rules: { ...DEFAULT_RULES }
      });
    }
  }, [program, open, initialFaculty]);

  const handleSave = () => {
    if (!formData.code || !formData.faculty) {
      toast({ title: "Validation Error", description: "Program code and Faculty are required.", variant: "destructive" });
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
    
    const branchName = newBranch.trim();
    setFormData(prev => ({
      ...prev,
      branches: [...(prev.branches || []), branchName],
      branchPrefixes: {
        ...(prev.branchPrefixes || {}),
        [branchName]: newPrefix.trim() || branchName.substring(0, 2).toUpperCase()
      }
    }));
    setNewBranch('');
    setNewPrefix('');
  };

  const removeBranch = (branch: string) => {
    const newPrefixes = { ...(formData.branchPrefixes || {}) };
    delete newPrefixes[branch];
    
    setFormData(prev => ({
      ...prev,
      branches: prev.branches?.filter(b => b !== branch),
      branchPrefixes: newPrefixes
    }));
  };

  const isFacultyDisabled = userProfile?.role === 'dean_faculty';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl border-none">
        <DialogHeader className="p-6 border-b shrink-0 bg-background z-20">
          <DialogTitle className="font-headline text-2xl">
            {program ? 'Edit Program' : 'New Program Definition'}
          </DialogTitle>
          <DialogDescription>
            {isFacultyDisabled 
              ? `Configuring program for ${userProfile.faculty}.`
              : 'Configure program details, faculty association, and credit framework.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 w-full outline-none">
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
                <Label className="text-sm font-semibold">Assigned Faculty</Label>
                <Select 
                  value={formData.faculty} 
                  onValueChange={(v: any) => setFormData({ ...formData, faculty: v })}
                  disabled={isFacultyDisabled}
                >
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FACULTIES.map(faculty => (
                      <SelectItem key={faculty} value={faculty}>{faculty}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Program Code</Label>
                <Input 
                  placeholder="BTECH" 
                  value={formData.code || ''}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Academic Level</Label>
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
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-semibold">Managed Branches & Prefixes</Label>
              <div className="flex gap-2 items-end">
                <div className="grid gap-2 flex-1">
                  <Input 
                    placeholder="Branch Name" 
                    value={newBranch}
                    onChange={e => setNewBranch(e.target.value)}
                  />
                </div>
                <div className="grid gap-2 w-32">
                  <Input 
                    placeholder="Prefix" 
                    value={newPrefix}
                    onChange={e => setNewPrefix(e.target.value.toUpperCase())}
                  />
                </div>
                <Button type="button" onClick={addBranch} variant="secondary">
                  <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
              </div>

              {formData.branches && formData.branches.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead>Branch</TableHead>
                        <TableHead className="w-48">Prefix</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.branches.map(branch => (
                        <TableRow key={branch}>
                          <TableCell>{branch}</TableCell>
                          <TableCell className="font-mono text-xs">{formData.branchPrefixes?.[branch]}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => removeBranch(branch)}>
                              <X className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Total Semesters</Label>
                <Input 
                  type="number" 
                  value={formData.totalSemesters ?? ''}
                  onChange={e => setFormData({ ...formData, totalSemesters: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Total Credits Required</Label>
                <Input 
                  type="number" 
                  value={formData.rules?.totalRequired ?? ''} 
                  onChange={e => updateRule('totalRequired', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-semibold">Credit Framework (Min-Max)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">DSC Min</Label>
                  <Input type="number" value={formData.rules?.dscMin ?? ''} onChange={e => updateRule('dscMin', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">DSC Max</Label>
                  <Input type="number" value={formData.rules?.dscMax ?? ''} onChange={e => updateRule('dscMax', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">DSE Min</Label>
                  <Input type="number" value={formData.rules?.dseMin ?? ''} onChange={e => updateRule('dseMin', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">DSE Max</Label>
                  <Input type="number" value={formData.rules?.dseMax ?? ''} onChange={e => updateRule('dseMax', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">OFE Min</Label>
                  <Input type="number" value={formData.rules?.ofeMin ?? ''} onChange={e => updateRule('ofeMin', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">OFE Max</Label>
                  <Input type="number" value={formData.rules?.ofeMax ?? ''} onChange={e => updateRule('ofeMax', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Program Description</Label>
              <Textarea 
                placeholder="Briefly describe the program objectives..." 
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[100px]"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 bg-muted/20 border-t shrink-0 z-20">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Program</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}