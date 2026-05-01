
'use client';

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { AuditLog } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { History, ShieldCheck, Loader2 } from 'lucide-react';

export default function AuditPage() {
  const db = useFirestore();

  const auditLogsQuery = useMemoFirebase(() => {
    return query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(50));
  }, [db]);

  const { data: logs, loading } = useCollection<AuditLog>(auditLogsQuery);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">System Audit Logs</h1>
        <p className="text-muted-foreground">Immutable record of all academic and administrative operations.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Operation History
          </CardTitle>
          <CardDescription>Review the latest 50 system activities.</CardDescription>
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
                      <span className="font-medium">{log.userEmail}</span>
                      <span className="text-[10px] text-muted-foreground">ID: {log.userId}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.actionType}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.entityId}</TableCell>
                  <TableCell className="pr-6 text-sm italic text-muted-foreground">
                    {log.details}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    <ShieldCheck className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No audit records found in the current period.</p>
                  </TableRow>
                )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
