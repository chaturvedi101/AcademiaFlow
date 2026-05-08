
"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Layers, ArrowRight, Info, AlertTriangle, Plus, Trash2, ShieldAlert } from "lucide-react";
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
  const [selection, setSelection] = useState({
    oldSub: "",
    newSub: ""
  });

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
       toast({ 
         title: "Mapping Violation", 
         description: "Mapping is disabled for Practical, Lab, or Sessional subjects.", 
         variant: "destructive" 
       });
       return;
    }

    if (oldS.sem !== newS.sem) {
       toast({ 
         title: "Mapping Violation", 
         description: "Equivalent subjects must belong to the same semester.", 
         variant: "destructive" 
       });
       return;
    }

    setMappings([...mappings, { id: Math.random(), oldS, newS }]);
    setSelection({ oldSub: "", newSub: "" });
    toast({ title: "Mapping Created", description: "Subject equivalence registered successfully." });
  };

  if (profile?.role === 'bos_member') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="bg-red-50 p-4 rounded-full">
          <ShieldAlert className="w-12 h-12 text-red-600" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold">Access Restricted</h2>
          <p className="text-muted-foreground max-w-md mt-2">
            Equivalence management is restricted to BoS Convenors and higher academic roles.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to Dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold">Scheme Transition Management</h1>
        <p className="text-muted-foreground">Map historical subjects to the new NEP 2020 structure with strict equivalence rules.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 shadow-md border-primary/5 h-fit">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Create Mapping</CardTitle>
            <CardDescription>Select subjects to establish equivalence.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label>Old Scheme Subject (2020 Batch)</Label>
              <Select value={selection.oldSub} onValueChange={v => setSelection({...selection, oldSub: v})}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select subject..." /></SelectTrigger>
                <SelectContent>
                  {oldSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.code} - {s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center">
              <div className="bg-muted p-2 rounded-full">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-3">
              <Label>New NEP Scheme Subject (2024 Batch)</Label>
              <Select value={selection.newSub} onValueChange={v => setSelection({...selection, newSub: v})}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Select subject..." /></SelectTrigger>
                <SelectContent>
                  {newSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.code} - {s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-primary/5 rounded-xl border border-primary/10 space-y-2">
               <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider">
                 <Info className="w-3.5 h-3.5" />
                 Equivalence Constraints
               </div>
               <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                 <li>Semesters must match exactly.</li>
                 <li>Only Theory subjects can be mapped.</li>
                 <li>Immutability applies after final approval.</li>
               </ul>
            </div>

            <Button className="w-full h-12 gap-2 text-base font-medium shadow-lg" onClick={handleAddMapping}>
              <Plus className="w-4 h-4" /> Register Equivalence
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-md">
          <CardHeader>
            <CardTitle className="font-headline text-xl">Equivalence Registry</CardTitle>
            <CardDescription>Current mapped subjects for credit transfer verification.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="pl-6">Old Subject</TableHead>
                  <TableHead></TableHead>
                  <TableHead>New Subject</TableHead>
                  <TableHead className="text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="pl-6">
                      <div className="space-y-1">
                        <p className="font-bold text-sm">{m.oldS.code}</p>
                        <p className="text-xs text-muted-foreground">{m.oldS.title}</p>
                        <Badge variant="outline" className="text-[10px]">Sem {m.oldS.sem}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowRight className="w-4 h-4 text-accent inline" />
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-bold text-sm">{m.newS.code}</p>
                        <p className="text-xs text-muted-foreground">{m.newS.title}</p>
                        <Badge variant="outline" className="text-[10px]">Sem {m.newS.sem}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button variant="ghost" size="icon" className="text-red-400" onClick={() => setMappings(mappings.filter(x => x.id !== m.id))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {mappings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                      <Layers className="w-12 h-12 mx-auto mb-4 opacity-10" />
                      <p>No equivalences established for the selected schemes.</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
