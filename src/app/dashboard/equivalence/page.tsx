
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight, Info, Plus, Trash2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser, useDoc, useFirestore } from "@/firebase";
import { doc } from "firebase/firestore";
import { UserProfile } from "@/lib/types";
import Link from "next/link";

export default function EquivalencePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const userDocRef = useMemo(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const [mappings, setMappings] = useState<any[]>([]);
  const [selection, setSelection] = useState({ oldSub: "", newSub: "" });

  const isBoS = profile?.role === 'bos_member' || profile?.role === 'bos_convenor';
  const isAdmin = profile?.role === 'admin' || profile?.role === 'dean_academic';

  const oldSubjects = [
    { id: 'o1', code: 'CS101', title: 'Programming Fundamentals', sem: 1, type: 'Theory' },
    { id: 'o2', code: 'CS102L', title: 'Programming Lab', sem: 1, type: 'Practical' },
    { id: 'o3', code: 'EC201', title: 'Digital Electronics', sem: 3, type: 'Theory' },
  ];

  const newSubjects = [
    { id: 'n1', code: 'CSE1101', title: 'Intro to Programming', sem: 1, type: 'Theory' },
    { id: 'n2', code: 'CSE1102L', title: 'Data Structures Lab', sem: 1, type: 'Practical' },
    { id: 'n3', code: 'CSE1301', title: 'Advanced Digital Logic', sem: 3, type: 'Theory' },
  ];

  const handleAddMapping = () => {
    const oldS = oldSubjects.find(s => s.id === selection.oldSub);
    const newS = newSubjects.find(s => s.id === selection.newSub);
    if (!oldS || !newS) return;
    if (oldS.type === 'Practical') {
       toast({ title: "Mapping Violation", description: "Theory only.", variant: "destructive" });
       return;
    }
    if (oldS.sem !== newS.sem) {
       toast({ title: "Mapping Violation", description: "Semesters must match.", variant: "destructive" });
       return;
    }
    setMappings([...mappings, { id: Math.random(), oldS, newS }]);
    setSelection({ oldSub: "", newSub: "" });
    toast({ title: "Mapping Created", description: "Subject equivalence registered." });
  };

  if (profile?.role === 'bos_member') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-600" />
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <Button asChild variant="outline"><Link href="/dashboard">Return</Link></Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Scheme Transition Management</h1>
        <p className="text-muted-foreground">Map historical subjects to the new NEP 2020 structure.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader><CardTitle className="text-xl">Create Mapping</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Old Subject</Label>
              <Select value={selection.oldSub} onValueChange={v => setSelection({...selection, oldSub: v})}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{oldSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.code} - {s.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-3">
              <Label>New Subject</Label>
              <Select value={selection.newSub} onValueChange={v => setSelection({...selection, newSub: v})}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{newSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.code} - {s.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full h-12" onClick={handleAddMapping}><Plus className="w-4 h-4 mr-2" /> Register Equivalence</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader><CardTitle className="text-xl">Equivalence Registry</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead className="pl-6">Old Subject</TableHead><TableHead></TableHead><TableHead>New Subject</TableHead>{isAdmin && <TableHead className="text-right pr-6">Action</TableHead>}</TableRow></TableHeader>
              <TableBody>
                {mappings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6"><p className="font-bold text-sm">{m.oldS.code}</p><Badge variant="outline">Sem {m.oldS.sem}</Badge></TableCell>
                    <TableCell><ArrowRight className="w-4 h-4 text-accent" /></TableCell>
                    <TableCell><p className="font-bold text-sm">{m.newS.code}</p><Badge variant="outline">Sem {m.newS.sem}</Badge></TableCell>
                    {isAdmin && (
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="icon" className="text-red-400" onClick={() => setMappings(mappings.filter(x => x.id !== m.id))}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
