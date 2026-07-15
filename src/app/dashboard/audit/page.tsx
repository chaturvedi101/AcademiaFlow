'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, limit, doc, getDocs, collectionGroup, writeBatch, deleteDoc } from 'firebase/firestore';
import { AuditLog, Syllabus, Scheme, UserProfile, Program } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, ShieldCheck, Loader2, AlertTriangle, Trash2, RefreshCw, Layers, Database, Search, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuditPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const isAdmin = profile?.role === 'admin';

  // 1. Audit Logs Query
  const auditLogsQuery = useMemoFirebase(() => {
    return query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
  }, [db]);
  const { data: logs, loading: logsLoading } = useCollection<AuditLog>(auditLogsQuery);

  // 2. Registry Integrity State
  const [isAuditing, setIsAuditing] = useState(false);
  const [fragments, setFragments] = useState<{ id: string; code: string; schemeId: string; reason: string; path: string }[]>([]);
  const [isPurging, setIsPurging] = useState(false);

  const runIntegrityAudit = async () => {
    if (!isAdmin) return;
    setIsAuditing(true);
    try {
      // Fetch all schemes to check for existence
      const schemesSnap = await getDocs(collection(db, 'schemes'));
      const activeSchemeIds = new Set(schemesSnap.docs.map(d => d.id));

      // Fetch all syllabi globally
      const syllabiSnap = await getDocs(collectionGroup(db, 'syllabi'));
      const detectedFragments: any[] = [];

      syllabiSnap.docs.forEach(d => {
        const data = d.data() as Syllabus;
        const path = d.ref.path;
        
        // Logic 1: Parent scheme no longer exists (Zombie)
        if (!activeSchemeIds.has(data.schemeId)) {
          detectedFragments.push({
            id: d.id,
            code: data.subjectCode,
            schemeId: data.schemeId,
            reason: 'Zombie (Deleted Parent Scheme)',
            path: path
          });
        }
        
        // Logic 2: Duplicate check / Orphan check can be added here
      });

      setFragments(detectedFragments);
      toast({ title: "Audit Complete", description: `Detected ${detectedFragments.length} orphaned or fragmented records.` });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Audit Failed", description: e.message });
    } finally {
      setIsAuditing(false);
    }
  };

  const handlePurgeFragments = async () => {
    if (!isAdmin || fragments.length === 0) return;
    setIsPurging(true);
    try {
      const batch = writeBatch(db);
      // Firebase batch limit is 500
      const purgeList = fragments.slice(0, 450);
      
      for (const frag of purgeList) {
        batch.delete(doc(db, frag.path));
      }
      
      await batch.commit();
      toast({ title: "Purge Successful", description: `Permanently removed ${purgeList.length} fragments.` });
      runIntegrityAudit(); // Re-scan
    } catch (e: any) {
      toast({ variant: "destructive", title: "Purge Failed", description: e.message });
    } finally {
      setIsPurging(false);
    }
  };

  if (logsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Institutional Audit & Integrity</h1>
        <p className="text-muted-foreground">Immutable record of operations and technical data consistency monitors.</p>
      </div>

      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="logs" className="gap-2"><History className="w-4 h-4" /> Operation History</TabsTrigger>
          {isAdmin && <TabsTrigger value="integrity" className="gap-2"><ShieldAlert className="w-4 h-4" /> Registry Integrity</TabsTrigger>}
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Latest Activities
              </CardTitle>
              <CardDescription>Review the latest 50 system operations across all technical tiers.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead className="pr-6">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="pl-6 text-xs text-muted-foreground">
                        {log.timestamp?.toDate().toLocaleString() || 'Just now'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{log.userEmail}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">ID: {log.userId?.substring(0,8)}...</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[9px] font-black">{log.actionType}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px]">{log.entityId}</TableCell>
                      <TableCell className="pr-6 text-xs italic text-muted-foreground">
                        {log.details}
                      </TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p>No operation records found in the current audit period.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="integrity" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 border-primary/10 bg-gradient-to-br from-white to-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary" />
                    Registry Scanner
                  </CardTitle>
                  <CardDescription>Scan global database for course code fragments and "Zombie" records.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <div className="p-4 bg-white border rounded-xl space-y-3">
                     <p className="text-[11px] font-bold uppercase text-primary">Audit Scope:</p>
                     <ul className="text-[10px] space-y-2 text-muted-foreground list-disc pl-4">
                       <li>Verify all <b>Syllabus</b> objects have active <b>Scheme</b> parents.</li>
                       <li>Detect subject codes orphaned by failed deletions.</li>
                       <li>Free up locked nomenclature slots for re-assignment.</li>
                     </ul>
                   </div>
                   <Button className="w-full h-12 gap-2 shadow-lg" onClick={runIntegrityAudit} disabled={isAuditing}>
                     {isAuditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                     Perform Global Integrity Audit
                   </Button>
                   {fragments.length > 0 && (
                     <Button variant="destructive" className="w-full h-12 gap-2 shadow-inner" onClick={handlePurgeFragments} disabled={isPurging}>
                       {isPurging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                       Purge {fragments.length} Detected Fragments
                     </Button>
                   )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 shadow-sm border-none bg-white overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                   <CardTitle className="text-lg flex items-center gap-2">
                     <Database className="w-5 h-5 text-muted-foreground" />
                     Nomenclature Conflict Map
                   </CardTitle>
                   <CardDescription>Detected fragments currently occupying technical nomenclature slots.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="pl-6">Fragment Code</TableHead>
                          <TableHead>Legacy Scope</TableHead>
                          <TableHead>Integrity Issue</TableHead>
                          <TableHead className="text-right pr-6">Firestore Path</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fragments.map((f, idx) => (
                          <TableRow key={idx} className="hover:bg-red-50/30 transition-colors">
                            <TableCell className="pl-6">
                              <Badge variant="outline" className="font-mono text-[10px] bg-white border-red-200 text-red-700">{f.code}</Badge>
                            </TableCell>
                            <TableCell>
                              <span className="text-[10px] font-bold text-muted-foreground">{f.schemeId}</span>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-red-100 text-red-800 border-none text-[8px] font-black uppercase">{f.reason}</Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                               <p className="text-[8px] font-mono text-muted-foreground truncate max-w-[200px] ml-auto">{f.path}</p>
                            </TableCell>
                          </TableRow>
                        ))}
                        {fragments.length === 0 && !isAuditing && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-32 text-muted-foreground">
                              <div className="flex flex-col items-center justify-center gap-4">
                                <ShieldCheck className="w-12 h-12 opacity-10" />
                                <div className="space-y-1">
                                  <p className="font-bold text-sm">Institutional Integrity Clean</p>
                                  <p className="text-[10px] opacity-60">No active fragments or zombie codes detected in technical tiers.</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {isAuditing && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-32 text-muted-foreground">
                               <div className="flex flex-col items-center gap-3">
                                  <Loader2 className="w-10 h-10 animate-spin text-primary opacity-20" />
                                  <p className="text-xs font-black uppercase tracking-widest animate-pulse">Deep Scanning Syllabi Registry...</p>
                               </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
            
            <div className="p-8 bg-amber-50 border border-amber-200 rounded-3xl flex gap-6 items-center">
               <div className="h-16 w-16 bg-amber-100 rounded-2xl flex items-center justify-center shrink-0">
                 <AlertTriangle className="w-8 h-8 text-amber-600" />
               </div>
               <div className="space-y-1">
                 <h4 className="font-headline font-bold text-amber-900">Why do fragments occur?</h4>
                 <p className="text-sm text-amber-800/80 leading-relaxed">
                   When a <b>Scheme</b> is deleted or a <b>BoS Convenor</b> force-reverts a submission, low-level syllabus documents can sometimes remain orphaned if the browser session is interrupted. The <b>Integrity Auditor</b> identifies these non-linked records, allowing you to reclaim those subject codes for the next <b>Batch 2026-30</b> synchronization cycle.
                 </p>
               </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
