"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useFirestore, useDoc, useCollection, useUser, useMemoFirebase } from "@/firebase";
import { doc, collection, setDoc, serverTimestamp, updateDoc, query, where, onSnapshot, Unsubscribe, deleteDoc, writeBatch, getDocs } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit3, Loader2, FileText, BookOpen, Eye, CheckCircle2, ShieldCheck, Trash2, Hash, Layers, Info, RefreshCw, Copy, ShieldAlert, GitBranch, PlusCircle, Sparkles, AlertTriangle, TrendingUp, CheckCircle, Target, Unlink, FileSearch } from "lucide-react";
import { SyllabusDialog } from "@/components/schemes/SyllabusDialog";
import { CreditValidator } from "@/components/schemes/CreditValidator";
import { Syllabus, Scheme, Program, UserProfile, SubmissionScope, CreditCategory } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { exportFullSchemeToPDF, exportCompleteSyllabusToPDF } from "@/lib/pdf-export";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { analyzeScheme, AnalyzeSchemeOutput } from "@/ai/flows/analyze-scheme-flow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";

export default function SchemeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: schemeId } = React.use(params);
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const schemeRef = useMemoFirebase(() => doc(db, 'schemes', schemeId), [db, schemeId]);
  const { data: scheme, loading: schemeLoading } = useDoc<Scheme>(schemeRef);

  const syllabiRef = useMemoFirebase(() => collection(db, 'schemes', schemeId, 'syllabi'), [db, schemeId]);
  const { data: localSyllabi, loading: syllabiLoading } = useCollection<Syllabus>(syllabiRef);

  const programRef = useMemoFirebase(() => (scheme?.programId && scheme.programId !== 'INSTITUTIONAL' ? doc(db, 'programs', scheme.programId) : null), [db, scheme?.programId]);
  const { data: program } = useDoc<Program>(programRef);

  const [allParentSyllabi, setAllParentSyllabi] = useState<Syllabus[]>([]);
  const [parentsLoading, setParentsLoading] = useState(false);
  const [isSubmissionDialogOpen, setIsSubmissionDialogOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedScope, setSelectedScope] = useState<SubmissionScope>('Complete');

  // AI Auditor State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<AnalyzeSchemeOutput | null>(null);
  const [isAnalysisDialogOpen, setIsAnalysisDialogOpen] = useState(false);

  const activeListeners = useRef<Record<string, Unsubscribe>>({});
  const syllabiMap = useRef<Map<string, Syllabus[]>>(new Map());

  // RECURSIVE INHERITANCE RESOLUTION ENGINE
  useEffect(() => {
    if (!scheme || syllabiLoading) return;

    const neededSchemeIds = new Set<string>();
    
    const scanForIds = (list: Syllabus[]) => {
      list.forEach(s => {
        if (s.parentSchemeId && s.parentSchemeId !== schemeId && !neededSchemeIds.has(s.parentSchemeId)) {
          neededSchemeIds.add(s.parentSchemeId);
        }
      });
    };

    scanForIds(localSyllabi);
    scanForIds(allParentSyllabi);

    Object.keys(activeListeners.current).forEach(id => {
      if (!neededSchemeIds.has(id)) {
        activeListeners.current[id]();
        delete activeListeners.current[id];
        syllabiMap.current.delete(id);
      }
    });

    if (neededSchemeIds.size === 0) {
      if (allParentSyllabi.length > 0) setAllParentSyllabi([]);
      setParentsLoading(false);
      return;
    }

    setParentsLoading(true);
    let resolvedCount = 0;

    neededSchemeIds.forEach(psId => {
      if (activeListeners.current[psId]) {
        resolvedCount++;
        if (resolvedCount >= neededSchemeIds.size) setParentsLoading(false);
        return;
      }

      const sRef = collection(db, 'schemes', psId, 'syllabi');
      activeListeners.current[psId] = onSnapshot(sRef, (sSnap) => {
        const fetched = sSnap.docs.map(d => ({ 
          ...d.data(), 
          id: d.id,
          parentSchemeId: psId,
          isAuthoritativeSource: true
        } as Syllabus));
        
        syllabiMap.current.set(psId, fetched);
        
        const allFlattened: Syllabus[] = [];
        syllabiMap.current.forEach(list => allFlattened.push(...list));
        setAllParentSyllabi(allFlattened);
        
        resolvedCount++;
        if (resolvedCount >= neededSchemeIds.size) setParentsLoading(false);
      }, (err) => {
        console.error("Parent sync failure:", err);
        resolvedCount++;
        if (resolvedCount >= neededSchemeIds.size) setParentsLoading(false);
      });
    });
  }, [db, schemeId, scheme, localSyllabi, syllabiLoading, allParentSyllabi.length]);

  const [isSyllabusDialogOpen, setIsSyllabusDialogOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<Partial<Syllabus> | undefined>(undefined);

  const syllabi = useMemo(() => {
    if (!scheme) return [];

    // Cycle-safe iterative resolver for heritage chain
    const findAuthoritativeSource = (startId: string): Syllabus | null => {
      let currentId = startId;
      let lastDoc: Syllabus | null = null;
      const visited = new Set<string>();

      while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        const doc = allParentSyllabi.find(p => p.id === currentId);
        if (!doc) break;
        
        lastDoc = doc;
        // If it doesn't follow anything else, or follows itself, we've found the root
        if (!doc.followedFromId || doc.followedFromId === currentId) break;
        currentId = doc.followedFromId;
      }
      return lastDoc;
    };

    const resolvedLocal = localSyllabi.map(local => {
      const isMirrored = !!local.followedFromId;
      const source = local.followedFromId ? findAuthoritativeSource(local.followedFromId) : null;

      if (source) {
        return {
          ...source, 
          id: local.id, 
          subjectCode: local.subjectCode, 
          parentCode: source.subjectCode, 
          semester: local.semester, 
          schemeId: local.schemeId,
          followedFromId: local.followedFromId,
          parentSchemeId: local.parentSchemeId,
          creditCategory: local.creditCategory, 
          isStandardized: true,
          standardizedFrom: 'Institutional Heritage Chain',
          electiveGroupId: local.electiveGroupId || source.electiveGroupId || '',
          timetableSlot: local.timetableSlot || source.timetableSlot || ''
        } as Syllabus;
      }

      return {
        ...local,
        isStandardized: isMirrored,
        standardizedFrom: isMirrored ? 'Syncing Heritage Content...' : undefined
      } as Syllabus;
    });

    return resolvedLocal.sort((a, b) => {
      if (a.semester !== b.semester) return (a.semester || 1) - (b.semester || 1);
      const slotA = a.timetableSlot || "Z";
      const slotB = b.timetableSlot || "Z";
      if (slotA !== slotB) {
        return slotA.localeCompare(slotB, undefined, { numeric: true, sensitivity: 'base' });
      }
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
  }, [localSyllabi, allParentSyllabi, scheme]);

  const permissions = useMemo(() => {
    if (!profile || !scheme) return { isAdmin: false, isDeanAcademic: false, canEditScheme: false, isLockedForBoS: true, canDeleteCourse: false, canEditSyllabus: () => false, canAudit: false };

    const isAdmin = profile.role === 'admin';
    const isDeanAcademic = profile.role === 'dean_academic';
    const isAuthority = ['dean_academic', 'dean_faculty', 'monitor'].includes(profile.role);
    const isPersonnel = ['bos_convenor', 'bos_member', 'committee_convenor'].includes(profile.role);
    
    const isCommonTier = profile.faculty?.includes('(Common BOS)');
    const isBTECHTier = profile.faculty?.includes('BTECH');
    const isBBATier = profile.faculty?.includes('BBA');
    const isScienceDean = profile.role === 'dean_faculty' && profile.faculty === 'Faculty of Sciences';

    let isMyJurisdiction = false;
    
    if (isAdmin) {
      isMyJurisdiction = true;
    } else if (profile.role === 'committee_convenor') {
      isMyJurisdiction = scheme.isCommitteePool && scheme.branch === profile.faculty;
    } else if (['bos_convenor', 'bos_member'].includes(profile.role)) {
      const hasExplicitAssignment = profile.managedBranches?.some(m => 
        m.programId === scheme.programId && m.branch === scheme.branch
      );
      
      let hasTieredOversight = false;
      if (isCommonTier) {
        if (scheme.programId === 'INSTITUTIONAL') {
          if (isBTECHTier && (scheme.branch?.includes('BTECH') || scheme.isVerticalPool)) hasTieredOversight = true;
          if (isBBATier && (scheme.branch?.includes('BBA') || scheme.isVerticalPool)) hasTieredOversight = true;
        } else if (program) {
          if (isBTECHTier && (program.faculty.includes('BTECH') || program.name.includes('BTECH'))) hasTieredOversight = true;
          if (isBBATier && (program.faculty.includes('Management') || program.name.includes('BBA'))) hasTieredOversight = true;
        }
      }
      isMyJurisdiction = hasExplicitAssignment || hasTieredOversight;
    } else if (isScienceDean && scheme.isCommitteePool) {
      const scienceCommittees = ['Course Committee - Physics', 'Course Committee - Chemistry', 'Course Committee - Mathematics'];
      if (scienceCommittees.includes(scheme.branch || '')) isMyJurisdiction = true;
    }

    const isLocked = scheme.status !== 'Draft' && !isAdmin;
    const canEditScheme = !isAuthority && (isAdmin || (isPersonnel && isMyJurisdiction)) && !isLocked;
    
    return {
      isAdmin,
      isDeanAcademic,
      canEditScheme,
      isLockedForBoS: isLocked,
      canDeleteCourse: isAdmin || canEditScheme,
      canEditSyllabus: (s: Partial<Syllabus> | undefined) => {
        if (!s) return false;
        if (isAdmin) return true;
        if (isAuthority) return false;
        if (isLocked) return false;
        return isPersonnel && isMyJurisdiction;
      },
      canAudit: isAdmin // RESTRICTED TO ADMIN ONLY
    };
  }, [profile, scheme, program]);

  const handlePerformAIAudit = async () => {
    if (!scheme || !program || isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScheme({
        schemeName: scheme.branch || program.name,
        batchYear: scheme.batchYear,
        programRules: program.rules,
        // LIMIT AUDIT TO FIRST TWO SEMESTERS ONLY
        syllabi: syllabi
          .filter(s => s.semester === 1 || s.semester === 2)
          .map(s => ({
            code: s.subjectCode,
            title: s.title,
            credits: s.credits,
            category: s.creditCategory,
            units: s.units?.map(u => ({ title: u.title, co: u.courseOutcome }))
          }))
      });
      setAnalysisReport(result);
      setIsAnalysisDialogOpen(true);
      toast({ title: "Institutional Audit Complete", description: "AI Auditor has finalized the Year 1 curriculum report." });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Audit Engine Error", description: e.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const creditDistribution = useMemo(() => {
    const dist = { DSC: 0, DSE: 0, OFE: 0, VAC: 0, AEC: 0, SEC: 0, MDC: 0, PRJ: 0, total: 0 };
    const processedGroups = new Map<string, number>();

    syllabi.forEach(sub => {
      const cat = sub.creditCategory as keyof typeof dist;
      if (!(cat in dist)) return;

      const isCore = ['DSC', 'PRJ', 'SEC'].includes(cat);
      if (!isCore && sub.electiveGroupId) {
        const groupKey = `${cat}-${sub.electiveGroupId}`;
        if (!processedGroups.has(groupKey)) {
          dist[cat] += (sub.credits || 0);
          dist.total += (sub.credits || 0);
          processedGroups.set(groupKey, sub.credits || 0);
        }
      } else {
        dist[cat] += (sub.credits || 0);
        dist.total += (sub.credits || 0);
      }
    });
    return dist;
  }, [syllabi]);

  const isSchemeValid = useMemo(() => {
    if (scheme?.isVerticalPool || scheme?.isCommitteePool) return true; 
    if (!program?.rules) return false;
    if (selectedScope === 'Year 1') return syllabi.some(s => s.semester === 1) && syllabi.some(s => s.semester === 2);
    return Math.abs(creditDistribution.total - program.rules.totalRequired) < 0.1;
  }, [creditDistribution, program?.rules, scheme, selectedScope, syllabi]);

  const handleSaveSyllabus = async (data: Partial<Syllabus>) => {
    const docId = data.id || Math.random().toString(36).substr(2, 9);
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', docId);

    const { 
      isStandardized, 
      standardizedFrom, 
      isAuthoritativeSource, 
      isInherited,
      ...persistableData 
    } = data as any;

    const payload: any = { 
      ...persistableData,
      id: docId, 
      schemeId, 
      updatedAt: serverTimestamp() 
    };

    return setDoc(docRef, payload, { merge: true })
      .then(() => {
        toast({ 
          title: "Curriculum Synchronized", 
          description: `Successfully stored ${payload.subjectCode || 'Course'}: ${payload.title || 'Draft'}.`
        });
      })
      .catch(async (err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: payload
        }));
      });
  };

  const handleDeleteSyllabus = async (syllabusId: string) => {
    if (!permissions.canDeleteCourse) return;
    const docRef = doc(db, 'schemes', schemeId, 'syllabi', syllabusId);
    deleteDoc(docRef).then(() => toast({ title: "Subject Removed" }));
  };

  const handleSyncCodes = async () => {
    if (!permissions.canEditScheme || isSyncing) return;
    setIsSyncing(true);
    try {
      const batch = writeBatch(db);
      
      let branchPrefix = 'XX';
      if (scheme?.isCommitteePool) {
        const branchName = scheme.branch || '';
        if (branchName.includes('Mathematics')) branchPrefix = 'MATH';
        else if (branchName.includes('Physics')) branchPrefix = 'PHYS';
        else if (branchName.includes('Chemistry')) branchPrefix = 'CHEM';
        else if (branchName.includes('Humanities')) branchPrefix = 'HUMA';
        else if (branchName.includes('Basic Sciences')) branchPrefix = 'BSCI';
        else if (branchName.includes('Computers')) branchPrefix = 'COMP';
        else branchPrefix = 'COMM';
      } else if (scheme?.isVerticalPool) {
        branchPrefix = 'RT';
      } else if (program) {
        branchPrefix = program.branchPrefixes?.[scheme?.branch || ''] || scheme?.branch?.substring(0, 2).toUpperCase() || 'XX';
      }

      const sortedSyllabi = [...localSyllabi].sort((a, b) => {
        if (a.semester !== b.semester) return (a.semester || 1) - (b.semester || 1);
        const slotA = a.timetableSlot || "Z";
        const slotB = b.timetableSlot || "Z";
        if (slotA !== slotB) {
          return slotA.localeCompare(slotB, undefined, { numeric: true, sensitivity: 'base' });
        }
        return (a.title || "").localeCompare(b.title || "");
      });

      const sequenceCounters: Record<string, number> = {};
      const groupCodes: Record<string, { baseCode: string, counter: number }> = {};
      let updateCount = 0;

      const getPillarChar = (cat: string) => {
        switch(cat) {
          case 'DSC': return 'C';
          case 'DSE': case 'OFE': return 'E';
          case 'SEC': return 'S';
          case 'VAC': return 'V';
          case 'AEC': return 'A';
          case 'MDC': return 'M';
          case 'PRJ': return 'P';
          default: return 'C';
        }
      };

      sortedSyllabi.forEach(sub => {
        let targetPrefix = branchPrefix;
        const isCommonCategory = ['VAC', 'AEC', 'MDC'].includes(sub.creditCategory);
        if (isCommonCategory && !scheme?.isCommitteePool) {
          targetPrefix = 'RT';
        }

        const pedagogyChar = sub.type === 'Lab/Sessional' ? 'P' : (sub.creditCategory === 'PRJ' ? 'I' : 'L');
        const pillarChar = getPillarChar(sub.creditCategory);
        const yearDigit = Math.ceil((sub.semester || 1) / 2);
        
        const counterKey = `${targetPrefix}${pedagogyChar}${pillarChar}${yearDigit}`;
        const isElective = ['DSE', 'OFE', 'VAC', 'AEC', 'MDC', 'SEC'].includes(sub.creditCategory);
        
        let newCode = '';

        if (isElective && sub.electiveGroupId) {
          const groupKey = `${sub.semester}-${sub.creditCategory}-${sub.electiveGroupId}`;
          if (!groupCodes[groupKey]) {
            sequenceCounters[counterKey] = (sequenceCounters[counterKey] || 0) + 1;
            const seqStr = sequenceCounters[counterKey].toString().padStart(2, '0');
            const baseCode = `${targetPrefix}${pedagogyChar}${pillarChar}${yearDigit}${seqStr}`;
            groupCodes[groupKey] = { baseCode, counter: 0 };
          }
          groupCodes[groupKey].counter++;
          newCode = `${groupCodes[groupKey].baseCode}.${groupCodes[groupKey].counter}`;
        } else {
          sequenceCounters[counterKey] = (sequenceCounters[counterKey] || 0) + 1;
          const seqStr = sequenceCounters[counterKey].toString().padStart(2, '0');
          newCode = `${targetPrefix}${pedagogyChar}${pillarChar}${yearDigit}${seqStr}`;
        }

        const subRef = doc(db, 'schemes', schemeId, 'syllabi', sub.id);
        batch.update(subRef, { subjectCode: newCode, updatedAt: serverTimestamp() });
        updateCount++;
      });

      if (updateCount > 0) {
        await batch.commit();
        toast({ title: "Codes Synchronized", description: `Re-sequenced ${updateCount} subjects starting from 01 based on slot order.` });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsSyncing(false);
    }
  };

  const [isClonerOpen, setIsClonerOpen] = useState(false);
  const [clonerTargetBranch, setClonerTargetBranch] = useState("");
  const [isCloning, setIsCloning] = useState(false);

  const handleCreateLinkedCopy = async () => {
    if (!clonerTargetBranch || !program || !scheme || !permissions.isAdmin) return;
    setIsCloning(true);
    try {
      const batch = writeBatch(db);
      const targetPrefix = program.branchPrefixes?.[clonerTargetBranch] || clonerTargetBranch.substring(0, 2).toUpperCase();
      const newSchemeId = `${program.id.toUpperCase()}-${targetPrefix}-${scheme.batchYear}`;
      
      batch.set(doc(db, 'schemes', newSchemeId), {
        programId: program.id,
        branch: clonerTargetBranch,
        batchYear: scheme.batchYear,
        version: scheme.version,
        id: newSchemeId,
        schemeCode: newSchemeId,
        status: 'Draft',
        createdBy: user?.uid || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        hasMultipleExits: false,
        exitOptions: [],
        abcEnabled: true
      });

      for (const parentSub of localSyllabi) {
        const syllabusId = Math.random().toString(36).substr(2, 9);
        const syllabusRef = doc(db, 'schemes', newSchemeId, 'syllabi', syllabusId);
        
        const targetLinkId = parentSub.followedFromId || parentSub.id;
        const targetParentSchemeId = parentSub.parentSchemeId || scheme.id;
        const targetParentCode = parentSub.parentCode || parentSub.subjectCode;

        let transformedCode = parentSub.subjectCode;
        if (['DSC', 'DSE', 'PRJ', 'OFE', 'SEC'].includes(parentSub.creditCategory)) {
          transformedCode = targetPrefix + parentSub.subjectCode.substring(2);
        }

        batch.set(syllabusRef, {
          ...parentSub,
          id: syllabusId,
          schemeId: newSchemeId,
          subjectCode: transformedCode,
          followedFromId: targetLinkId,
          parentSchemeId: targetParentSchemeId,
          parentCode: targetParentCode,
          updatedAt: serverTimestamp()
        });
      }

      await batch.commit();
      toast({ title: "Linked Mirror Created", description: `${clonerTargetBranch} is now mirroring this structure.` });
      setIsClonerOpen(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Cloning Failed", description: e.message });
    } finally {
      setIsCloning(false);
    }
  };

  if (profileLoading || schemeLoading || syllabiLoading || parentsLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!scheme) return <div className="p-8 text-center">Scheme not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-headline font-bold">{scheme.branch || program?.name}</h1>
            {scheme.isVerticalPool && <Badge className="bg-emerald-100 text-emerald-700">VERTICAL POOL</Badge>}
            {scheme.isCommitteePool && <Badge className="bg-blue-100 text-blue-700">COMMITTEE POOL</Badge>}
          </div>
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <span className="font-mono font-bold text-primary flex items-center gap-1"><Hash className="w-3.5 h-3.5" /> {scheme.schemeCode}</span>
            <span>Batch: {scheme.batchYear}</span>
            <Badge variant={scheme.status === 'Approved' ? 'default' : 'secondary'} className="font-bold">
              {scheme.status} {permissions.isLockedForBoS && <span className="ml-1 opacity-60">(Locked)</span>}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {permissions.canAudit && (
            <Button variant="outline" onClick={handlePerformAIAudit} disabled={isAnalyzing} className="gap-2 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10">
              {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              AI Audit (Year 1)
            </Button>
          )}
          {permissions.isAdmin && !scheme.isCommitteePool && !scheme.isVerticalPool && (
            <Button variant="outline" onClick={() => setIsClonerOpen(true)} className="gap-2 border-primary/30 text-primary hover:bg-primary/5">
              <GitBranch className="w-4 h-4" /> Linked Cloner
            </Button>
          )}
          {permissions.canEditScheme && (
            <Button variant="outline" onClick={handleSyncCodes} disabled={isSyncing} className="gap-2">
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync Codes
            </Button>
          )}
          <Button variant="outline" onClick={() => exportFullSchemeToPDF(scheme, program || null, syllabi)}>
            <FileText className="w-4 h-4 mr-2" /> Structure
          </Button>
          <Button variant="outline" onClick={() => exportCompleteSyllabusToPDF(scheme, program || null, syllabi)}>
            <BookOpen className="w-4 h-4 mr-2" /> Syllabus
          </Button>
          {permissions.canEditScheme && (
            <Button onClick={() => setIsSubmissionDialogOpen(true)}>Finalize Scheme</Button>
          )}
        </div>
      </div>

      <Dialog open={isClonerOpen} onOpenChange={setIsClonerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Institutional Linked Cloner
            </DialogTitle>
            <DialogDescription>Create a Virtual Mirror for a sibling branch. All subjects will inherit heritage data recursively.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 rounded-xl space-y-2">
               <p className="text-[11px] font-bold uppercase text-primary">Cloning Protocol:</p>
               <ul className="text-[10px] space-y-1 text-muted-foreground list-disc pl-4">
                 <li><b>Heritage chain:</b> Mirrors directly from original source standard.</li>
                 <li><b>Live Link:</b> Child stays synchronized with pedagogical changes.</li>
               </ul>
             </div>
             <div className="space-y-2">
                <Label>Target Mirror Branch</Label>
                <Select value={clonerTargetBranch} onValueChange={setClonerTargetBranch}>
                   <SelectTrigger className="bg-white"><SelectValue placeholder="Select sibling branch..." /></SelectTrigger>
                   <SelectContent>
                      {program?.branches.filter(b => b !== scheme.branch).map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                   </SelectContent>
                </Select>
             </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClonerOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateLinkedCopy} disabled={!clonerTargetBranch || isCloning}>
               {isCloning ? <Loader2 className="animate-spin w-4 h-4" /> : <Copy className="w-4 h-4 mr-2" />}
               Generate Linked Mirror
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAnalysisDialogOpen} onOpenChange={setIsAnalysisDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="p-6 border-b bg-primary/5">
            <div className="flex items-center justify-between">
               <div>
                  <DialogTitle className="text-2xl font-headline font-bold flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-primary" />
                    Institutional AI Auditor Report (Year 1)
                  </DialogTitle>
                  <DialogDescription>Technical analysis of framework compliance for Semesters 1 & 2.</DialogDescription>
               </div>
               <div className="flex flex-col items-center justify-center bg-white rounded-xl px-6 py-2 border shadow-sm">
                  <span className={cn("text-3xl font-black", 
                    (analysisReport?.overallScore || 0) > 80 ? "text-emerald-600" : (analysisReport?.overallScore || 0) > 50 ? "text-amber-600" : "text-red-600"
                  )}>
                    {analysisReport?.overallScore}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Year 1 Score</span>
               </div>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="space-y-8 pb-12">
               <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-primary"><FileSearch className="w-5 h-5" /> Executive Summary</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed italic border-l-4 pl-4 bg-muted/20 py-3 rounded-r-lg">
                    "{analysisReport?.executiveSummary}"
                  </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="border-emerald-100 bg-emerald-50/10">
                     <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800"><TrendingUp className="w-4 h-4" /> Structural Strengths</CardTitle></CardHeader>
                     <CardContent>
                        <ul className="space-y-1.5">
                           {analysisReport?.structuralAudit.strengths.map((s, i) => (
                             <li key={i} className="text-xs flex gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /> {s}</li>
                           ))}
                        </ul>
                     </CardContent>
                  </Card>
                  <Card className="border-red-100 bg-red-50/10">
                     <CardHeader className="pb-2"><CardTitle className="text-sm font-bold flex items-center gap-2 text-red-800"><AlertTriangle className="w-4 h-4" /> Technical Weaknesses</CardTitle></CardHeader>
                     <CardContent>
                        <ul className="space-y-1.5">
                           {analysisReport?.structuralAudit.weaknesses.map((w, i) => (
                             <li key={i} className="text-xs flex gap-2"><AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" /> {w}</li>
                           ))}
                        </ul>
                     </CardContent>
                  </Card>
               </div>

               <div className="space-y-4">
                  <h3 className="font-bold flex items-center gap-2 text-primary"><BookOpen className="w-5 h-5" /> Pedagogical Quality Assessment</h3>
                  <div className="border rounded-xl overflow-hidden shadow-sm">
                    <Table>
                       <TableHeader className="bg-muted/50">
                          <TableRow>
                             <TableHead className="text-[10px] uppercase font-black">Course Slot</TableHead>
                             <TableHead className="text-[10px] uppercase font-black">Technical Findings</TableHead>
                             <TableHead className="text-[10px] uppercase font-black">Recommendations</TableHead>
                          </TableRow>
                       </TableHeader>
                       <TableBody>
                          {analysisReport?.pedagogicalQuality.map((q, i) => (
                            <TableRow key={i} className="hover:bg-muted/10">
                               <TableCell className="font-bold text-[11px] whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <span>{q.subjectCode}</span>
                                    <span className="text-[9px] text-muted-foreground font-medium">{q.title}</span>
                                  </div>
                               </TableCell>
                               <TableCell className="text-[10px] leading-relaxed text-muted-foreground">{q.findings}</TableCell>
                               <TableCell className="text-[10px] leading-relaxed font-medium text-primary">{q.recommendations}</TableCell>
                            </TableRow>
                          ))}
                       </TableBody>
                    </Table>
                  </div>
               </div>

               <div className="space-y-3">
                  <h3 className="font-bold flex items-center gap-2 text-primary"><Target className="w-5 h-5" /> Strategic Implementation Steps</h3>
                  <div className="grid gap-3">
                     {analysisReport?.strategicRecommendations.map((r, i) => (
                       <div key={i} className="p-3 bg-primary/5 border border-primary/10 rounded-xl text-xs font-medium text-primary flex gap-3">
                          <div className="h-5 w-5 rounded bg-primary text-white flex items-center justify-center shrink-0 font-bold">{i+1}</div>
                          {r}
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 border-t bg-muted/20">
             <Button onClick={() => setIsAnalysisDialogOpen(false)}>Close Audit Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {scheme.status === 'Draft' && scheme.reversionComments && (
        <Alert variant="destructive" className="bg-red-50 border-red-200">
          <Info className="h-4 w-4" />
          <AlertTitle className="font-bold">Dean's Observations (Requires Correction)</AlertTitle>
          <AlertDescription className="mt-2 text-sm italic">"{scheme.reversionComments}"</AlertDescription>
        </Alert>
      )}

      {permissions.isLockedForBoS && !permissions.isAdmin && (
        <Alert className="bg-amber-50 border-amber-200 text-amber-800">
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle className="font-bold">Submission Lock Active</AlertTitle>
          <AlertDescription>Review process active. Editing disabled until reversion.</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="md:col-span-3">
          <Tabs defaultValue="syllabi">
            <TabsList className="bg-white border w-full justify-start">
              <TabsTrigger value="syllabi">Curriculum Layout</TabsTrigger>
            </TabsList>
            <TabsContent value="syllabi" className="mt-6 space-y-6">
              {Array.from({ length: scheme.isCommitteePool ? 1 : (program?.totalSemesters || 8) }, (_, i) => i + 1).map(sem => {
                const semSyllabi = syllabi.filter(s => (scheme.isCommitteePool ? true : s.semester === sem));
                const processedGroups = new Set<string>();
                const renderedGroups = new Set<string>();
                
                const semTotalCredits = semSyllabi.reduce((sum, s) => {
                  const isCore = ['DSC', 'PRJ', 'SEC'].includes(s.creditCategory);
                  if (!isCore && s.electiveGroupId) {
                    if (processedGroups.has(s.electiveGroupId)) return sum;
                    processedGroups.add(s.electiveGroupId);
                  }
                  return sum + (s.credits || 0);
                }, 0);

                return (
                  <Card key={sem} className="shadow-sm border-none overflow-hidden">
                    <CardHeader className="bg-muted/20 py-4 px-6 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-4">
                        <CardTitle className="text-lg">{scheme.isCommitteePool ? 'Course Registry' : `Semester ${sem}`}</CardTitle>
                        {!scheme.isCommitteePool && (
                          <Badge variant="secondary" className="bg-white/50 text-primary border-primary/20">
                            Total: {semTotalCredits} Credits
                          </Badge>
                        )}
                      </div>
                      {permissions.canEditScheme && (
                        <Button size="sm" variant="outline" onClick={() => { setActiveSubject({ semester: sem }); setIsSyllabusDialogOpen(true); }}>
                          <Plus className="w-4 h-4 mr-2" /> Add Subject Slot
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="pl-6">Course Code (Local/Heritage)</TableHead>
                            <TableHead>Course Title</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-center">L-T-P</TableHead>
                            <TableHead className="text-right">Cr</TableHead>
                            <TableHead className="text-right pr-6">Slot</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {semSyllabi.map((sub) => {
                            const showGroupHeader = sub.electiveGroupId && !renderedGroups.has(sub.electiveGroupId);
                            if (sub.electiveGroupId) renderedGroups.add(sub.electiveGroupId);
                            
                            return (
                              <React.Fragment key={sub.id}>
                                {showGroupHeader && (
                                  <TableRow className="bg-primary/5 hover:bg-primary/5">
                                    <TableCell colSpan={6} className="py-2 px-6">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Layers className="w-3.5 h-3.5 text-primary" />
                                          <span className="text-[10px] font-black uppercase tracking-widest text-primary">
                                            {sub.electiveGroupId} (Pool Options)
                                          </span>
                                        </div>
                                        {permissions.canEditScheme && (
                                          <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-[10px] font-bold text-primary gap-1.5"
                                            onClick={() => {
                                              setActiveSubject({ 
                                                semester: sem, 
                                                creditCategory: sub.creditCategory,
                                                electiveGroupId: sub.electiveGroupId,
                                                type: sub.type,
                                                credits: sub.credits,
                                                lectureCredits: sub.lectureCredits,
                                                tutorialCredits: sub.tutorialCredits,
                                                practicalCredits: sub.practicalCredits
                                              });
                                              setIsSyllabusDialogOpen(true);
                                            }}
                                          >
                                            <PlusCircle className="w-3.5 h-3.5" /> Add Option
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="group">
                                  <TableCell className={cn("pl-6 font-mono font-bold", sub.electiveGroupId && "pl-10")}>
                                    <div className="flex flex-col">
                                      <span className={cn(sub.isStandardized && "text-primary")}>{sub.subjectCode}</span>
                                      {sub.parentCode && (
                                        <span className="text-[9px] text-emerald-600 italic font-black uppercase tracking-tighter">
                                          Mirror: {sub.parentCode}
                                        </span>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex flex-col">
                                      <span>{sub.title}</span>
                                      <span className="text-[10px] text-muted-foreground uppercase">{sub.type}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell><Badge variant="secondary" className="text-[9px]">{sub.creditCategory}</Badge></TableCell>
                                  <TableCell className="text-center text-xs">{sub.lectureCredits}-{sub.tutorialCredits}-{sub.practicalCredits}</TableCell>
                                  <TableCell className="text-right font-bold">{sub.credits}</TableCell>
                                  <TableCell className="text-right pr-6">
                                    <div className="flex justify-end items-center gap-4">
                                      <Badge variant="outline" className="font-mono bg-muted/30">{sub.timetableSlot || '-'}</Badge>
                                      <div className="flex items-center gap-2">
                                        {sub.isStandardized && (
                                          <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 text-emerald-700">
                                            <ShieldCheck className="w-3 h-3" /> Mirror
                                          </Badge>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setActiveSubject(sub); setIsSyllabusDialogOpen(true); }}>
                                          {permissions.canEditSyllabus(sub) ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        </Button>
                                        {permissions.canDeleteCourse && (
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400" onClick={() => handleDeleteSyllabus(sub.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          {!scheme.isVerticalPool && !scheme.isCommitteePool && (
            <CreditValidator currentCredits={creditDistribution} rules={program?.rules} />
          )}
        </div>
      </div>

      <Dialog open={isSubmissionDialogOpen} onOpenChange={setIsSubmissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submission Scope</DialogTitle>
            <DialogDescription>Finalize academic framework implementation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selectedScope} onValueChange={(v: any) => setSelectedScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Year 1">Year 1 (Semester 1 & 2)</SelectItem>
                <SelectItem value="Year 2">Up to Year 2 (Semesters 1-4)</SelectItem>
                <SelectItem value="Year 3">Up to Year 3 (Semesters 1-6)</SelectItem>
                <SelectItem value="Complete">Complete 4-Year Framework</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button disabled={!isSchemeValid} onClick={() => {
              updateDoc(schemeRef, { status: 'Pending Dean', submissionScope: selectedScope, reversionComments: null });
              setIsSubmissionDialogOpen(false);
              toast({ title: "Scheme Submitted", description: "Submission lock is now active." });
            }}>Finalize & Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SyllabusDialog 
        open={isSyllabusDialogOpen} 
        onOpenChange={setIsSyllabusDialogOpen} 
        syllabus={activeSubject}
        allSyllabi={syllabi}
        onSave={handleSaveSyllabus}
        canEdit={permissions.canEditSyllabus(activeSubject)}
        userProfile={profile || undefined}
        batchYear={scheme.batchYear}
        program={program || undefined}
        scheme={scheme}
      />
    </div>
  );
}
