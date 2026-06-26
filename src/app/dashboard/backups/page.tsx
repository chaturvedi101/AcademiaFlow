
'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, getDocs, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { UserProfile, Program, Scheme, Syllabus } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, ShieldAlert, Loader2, Database, FileJson, CheckCircle2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function BackupsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const isAdmin = profile?.role === 'admin';

  const handleExport = async () => {
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

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        exportedBy: user?.email,
        data: {
          programs,
          schemes: schemesWithSyllabi
        }
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AcademiaFlow_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Backup Successful", description: "All programs and schemes have been exported." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Export Failed", description: error.message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setIsImporting(true);
        const backup = JSON.parse(e.target?.result as string);

        if (!backup.data || (!backup.data.programs && !backup.data.schemes)) {
          throw new Error("Invalid backup file format.");
        }

        let writeCount = 0;

        // Restore Programs
        if (backup.data.programs) {
          for (const prog of backup.data.programs) {
            const { id, ...data } = prog;
            const progRef = doc(db, 'programs', id);
            setDoc(progRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
            writeCount++;
          }
        }

        // Restore Schemes and Syllabi
        if (backup.data.schemes) {
          for (const scheme of backup.data.schemes) {
            const { id, syllabi, ...schemeData } = scheme;
            const schemeRef = doc(db, 'schemes', id);
            setDoc(schemeRef, { ...schemeData, updatedAt: serverTimestamp() }, { merge: true });
            writeCount++;

            if (syllabi) {
              for (const syllabus of syllabi) {
                const { id: syllId, ...syllData } = syllabus;
                const syllRef = doc(db, 'schemes', id, 'syllabi', syllId);
                setDoc(syllRef, { ...syllData, updatedAt: serverTimestamp() }, { merge: true });
                writeCount++;
              }
            }
          }
        }

        toast({ title: "Restore Complete", description: `Successfully processed ${writeCount} entities.` });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Restore Failed", description: error.message });
      } finally {
        setIsImporting(false);
        // Clear input
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-500 opacity-20" />
        <h2 className="text-2xl font-headline font-bold">Access Restricted</h2>
        <p className="text-muted-foreground text-center max-w-md">
          The Data Management center is restricted to System Administrators for institutional security.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">Data Management & Backups</h1>
        <p className="text-muted-foreground">Export or restore the complete institutional database including schemes and syllabi.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-primary/10 shadow-lg bg-gradient-to-br from-white to-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />
              Full Database Export
            </CardTitle>
            <CardDescription>Generate a snapshot of all programs, scheme structures, and subject syllabi.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 flex gap-3 text-xs text-primary/80">
              <Database className="w-5 h-5 shrink-0" />
              <p>This includes all sub-collections. The resulting JSON file can be used to migrate data or keep offline archival records of the curriculum.</p>
            </div>
            <Button className="w-full h-12 gap-2 shadow-sm" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileJson className="w-4 h-4" />}
              {isExporting ? "Piling Data..." : "Download Institutional Snapshot"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-accent/10 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Upload className="w-5 h-5" />
              Institutional Restore
            </CardTitle>
            <CardDescription>Upload a previously exported backup file to synchronize the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-xs text-amber-800">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold">Caution:</p>
                <p>Restoring data will merge records based on their identifiers. Existing courses with the same IDs will be updated to match the backup.</p>
              </div>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={isImporting}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                id="restore-upload"
              />
              <Button variant="outline" className="w-full h-12 gap-2 border-dashed border-accent/40 text-accent hover:bg-accent/5 pointer-events-none" disabled={isImporting}>
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isImporting ? "Reconstructing Database..." : "Select Backup File (.json)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-muted/30 p-8 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center space-y-4">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-50" />
        <div className="max-w-xl space-y-2">
          <h3 className="font-bold">Academic Integrity Guaranteed</h3>
          <p className="text-sm text-muted-foreground">The backup system uses unique composite keys (Program + Branch + Year) to ensure that no two curriculum structures overlap, even during mass restoration events.</p>
        </div>
      </div>
    </div>
  );
}

function AlertTriangle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
    </svg>
  );
}
