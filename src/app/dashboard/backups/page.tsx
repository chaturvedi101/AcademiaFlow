'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, getDocs, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { UserProfile, Program, Scheme, Syllabus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, ShieldAlert, Loader2, Database, FileJson, CheckCircle2, AlertCircle, Search, Info, GitBranch } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BackupData {
  version: string;
  timestamp: string;
  exportedBy: string;
  data: {
    programs: any[];
    schemes: any[];
  };
}

export default function BackupsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<BackupData | null>(null);

  const isAdmin = profile?.role === 'admin';
  const canExport = isAdmin || profile?.role === 'bos_convenor';

  const handleExport = async () => {
    if (!canExport) return;
    setIsExporting(true);
    try {
      // 1. Fetch Programs
      const programsSnap = await getDocs(collection(db, 'programs'));
      const programs = programsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

      // 2. Fetch Schemes and their Syllabi
      const schemesSnap = await getDocs(collection(db, 'schemes'));
      const schemesWithSyllabi = await Promise.all(
        schemesSnap.docs.map(async (schemeDoc) => {
          const schemeData = schemeDoc.data() as Scheme;
          const syllabiSnap = await getDocs(collection(db, 'schemes', schemeDoc.id, 'syllabi'));
          const syllabi = syllabiSnap.docs.map(s => ({ ...s.data(), id: s.id }));
          return {
            ...schemeData,
            id: schemeDoc.id,
            syllabi
          };
        })
      );

      const backupData: BackupData = {
        version: '1.2',
        timestamp: new Date().toISOString(),
        exportedBy: user?.email || 'Anonymous',
        data: {
          programs,
          schemes: schemesWithSyllabi
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `RTU_AcademiaFlow_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Institutional Export Successful", description: "Curriculum snapshot saved locally." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Export Failed", description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backup = JSON.parse(e.target?.result as string) as BackupData;
        if (!backup.data || (!backup.data.programs && !backup.data.schemes)) {
          throw new Error("Invalid backup file format.");
        }
        setParsedBackup(backup);
        toast({ title: "Backup File Parsed", description: `Found ${backup.data.schemes.length} schemes in snapshot.` });
      } catch (err: any) {
        toast({ variant: "destructive", title: "Parsing Error", description: err.message });
        setParsedBackup(null);
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreFull = async () => {
    if (!isAdmin || !parsedBackup) return;
    setIsImporting(true);
    try {
      let writeCount = 0;

      // Restore Programs
      if (parsedBackup.data.programs) {
        for (const prog of parsedBackup.data.programs) {
          const { id, ...data } = prog;
          const progRef = doc(db, 'programs', id);
          await setDoc(progRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
          writeCount++;
        }
      }

      // Restore All Schemes
      for (const scheme of parsedBackup.data.schemes) {
        await restoreSingleSchemeData(scheme);
        writeCount++;
      }

      toast({ title: "Full Restore Complete", description: `Successfully processed ${writeCount} core entities.` });
      setParsedBackup(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Full Restore Failed", description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  const handleRestoreSelective = async (schemeId: string) => {
    if (!isAdmin || !parsedBackup) return;
    setIsImporting(true);
    try {
      const scheme = parsedBackup.data.schemes.find(s => s.id === schemeId);
      if (!scheme) throw new Error("Selected scheme not found in backup.");

      // Also restore the associated program if it exists in backup
      const program = parsedBackup.data.programs?.find(p => p.id === scheme.programId);
      if (program) {
        const { id, ...data } = program;
        await setDoc(doc(db, 'programs', id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      }

      await restoreSingleSchemeData(scheme);
      toast({ title: "Selective Restore Complete", description: `Successfully synchronized ${scheme.branch || scheme.id}.` });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Selective Restore Failed", description: error.message });
    } finally {
      setIsImporting(false);
    }
  };

  const restoreSingleSchemeData = async (scheme: any) => {
    const { id, syllabi, ...schemeData } = scheme;
    const schemeRef = doc(db, 'schemes', id);
    
    // 1. Sync Scheme Base
    await setDoc(schemeRef, { ...schemeData, updatedAt: serverTimestamp() }, { merge: true });

    // 2. Sync Syllabi
    if (syllabi && syllabi.length > 0) {
      const batch = writeBatch(db);
      syllabi.forEach((syllabus: any) => {
        const { id: syllId, ...syllData } = syllabus;
        const syllRef = doc(db, 'schemes', id, 'syllabi', syllId);
        batch.set(syllRef, { ...syllData, updatedAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }
  };

  if (profileLoading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary w-8 h-8" /></div>;

  if (!canExport) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 opacity-20" />
        <h2 className="text-2xl font-headline font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Curriculum data management is restricted to BoS Convenors and System Administrators.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">Curriculum Data Management</h1>
        <p className="text-muted-foreground">Export institutional archives or selectively restore branch schemes for **Batch 2026-30**.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-8">
          <Card className="border-primary/10 shadow-lg bg-gradient-to-br from-white to-primary/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5"><Database className="w-20 h-20" /></div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                Institutional Export
              </CardTitle>
              <CardDescription>Generate a comprehensive snapshot of all authorized programs and schemes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-3 text-xs text-primary/80">
                <Info className="w-5 h-5 shrink-0" />
                <p>This export contains all branch hierarchies, master slot patterns, and pedagogical units. Use this for offline archival and BoS coordination.</p>
              </div>
              <Button className="w-full h-12 gap-2 shadow-sm" onClick={handleExport} disabled={isExporting}>
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
                Download Complete Archive
              </Button>
            </CardContent>
          </Card>

          {isAdmin && (
            <Card className="border-accent/10 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <Upload className="w-5 h-5" />
                  Selective & Full Restore
                </CardTitle>
                <CardDescription>Upload an institutional backup file to synchronize records.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-xs text-amber-800">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <p>Restoring data merges records by ID. Use **Selective Restore** to fix specific branch syllabi without affecting other technical tiers.</p>
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    disabled={isImporting}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    id="restore-upload"
                  />
                  <Button variant="outline" className="w-full h-12 gap-2 border-dashed border-accent/40 text-accent hover:bg-accent/5 pointer-events-none" disabled={isImporting}>
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    {parsedBackup ? "File Loaded - See Inspector" : "Select Backup File (.json)"}
                  </Button>
                </div>

                {parsedBackup && (
                  <Button variant="destructive" className="w-full h-12 gap-2 shadow-inner" onClick={handleRestoreFull} disabled={isImporting}>
                     <ShieldAlert className="w-4 h-4" /> Finalize Full Institutional Restore
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-7">
          <Card className="h-full border-none shadow-sm bg-white overflow-hidden">
             <CardHeader className="bg-muted/10 border-b">
               <CardTitle className="text-lg flex items-center gap-2">
                 <GitBranch className="w-5 h-5 text-muted-foreground" />
                 Backup Inspector & Selective Sync
               </CardTitle>
               <CardDescription>Preview content before applying changes to the production database.</CardDescription>
             </CardHeader>
             <CardContent className="p-0">
               {parsedBackup ? (
                 <div className="flex flex-col h-full">
                    <div className="p-4 bg-primary/5 border-b grid grid-cols-3 gap-4">
                       <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Snapshot Version</p>
                          <p className="text-sm font-mono font-bold text-primary">{parsedBackup.version}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Generated Date</p>
                          <p className="text-xs font-medium">{new Date(parsedBackup.timestamp).toLocaleString()}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">Authorized By</p>
                          <p className="text-xs font-medium truncate">{parsedBackup.exportedBy}</p>
                       </div>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="pl-6">Branch Scheme</TableHead>
                            <TableHead>Batch</TableHead>
                            <TableHead className="text-right pr-6">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedBackup.data.schemes.map((s, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="pl-6">
                                <div className="flex flex-col">
                                  <span className="font-bold text-sm">{s.branch || 'Institutional Pool'}</span>
                                  <span className="text-[10px] text-muted-foreground uppercase font-black">{s.programId}</span>
                                </div>
                              </TableCell>
                              <TableCell><Badge variant="outline" className="font-mono text-[10px]">{s.batchYear}</Badge></TableCell>
                              <TableCell className="text-right pr-6">
                                {isAdmin ? (
                                  <Button variant="ghost" size="sm" className="text-primary h-8 gap-2 font-bold text-[10px]" onClick={() => handleRestoreSelective(s.id)} disabled={isImporting}>
                                    <RefreshCcw className="w-3.5 h-3.5" /> SELECTIVE SYNC
                                  </Button>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground italic">Admin-only restore</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-32 text-muted-foreground space-y-4">
                    <FileJson className="w-12 h-12 opacity-10" />
                    <p className="text-sm">Upload a JSON backup to inspect branch contents.</p>
                 </div>
               )}
             </CardContent>
          </Card>
        </div>
      </div>

      <div className="bg-muted/30 p-8 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center space-y-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
        <div className="max-w-xl space-y-2">
          <h3 className="font-bold">Institutional Integrity Guard</h3>
          <p className="text-sm text-muted-foreground">The selective restore engine ensures that program rules are synchronized before curriculum content is applied, maintaining RTU-NEP 2020 compliance across all branches in Kota.</p>
        </div>
      </div>
    </div>
  );
}

function RefreshCcw({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>
    </svg>
  );
}
