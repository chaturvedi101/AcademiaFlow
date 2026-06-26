
'use client';

import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, Globe, ShieldCheck, User, Code, Info, Terminal, ExternalLink, AlertTriangle, Key } from 'lucide-react';

export default function SettingsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const repoUrl = "https://github.com/chaturvedi101/AcademiaFlow.git";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">System Settings</h1>
        <p className="text-muted-foreground">Manage your account and institutional connectivity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Account Profile
            </CardTitle>
            <CardDescription>Your current institutional authorization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
              <div className="bg-primary/10 p-3 rounded-full">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-bold">{profile?.displayName}</p>
                <p className="text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Assigned Role</p>
                <Badge variant="secondary" className="uppercase text-[10px] font-bold px-3 py-1">
                  {profile?.role?.replace('_', ' ')}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Jurisdiction</p>
                <p className="text-xs font-medium">{profile?.faculty || 'Branch-specific'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <Github className="w-5 h-5" />
              Repository Connectivity
            </CardTitle>
            <CardDescription>Academic source code synchronization status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Remote Origin</p>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border font-mono text-[10px] break-all">
                <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
                {repoUrl}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Version Control</span>
                <Badge className="bg-emerald-100 text-emerald-700 border-none">ACTIVE</Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Branch Name</span>
                <span className="font-bold text-accent">main</span>
              </div>
            </div>

            <Button variant="outline" className="w-full h-11 gap-2 border-dashed" asChild>
              <a href="https://github.com/chaturvedi101/AcademiaFlow" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" /> Open GitHub Repository
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Terminal className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-400">
              <Code className="w-5 h-5" />
              Terminal Sync Guide
            </CardTitle>
            <CardDescription className="text-slate-400">Commands for institutional synchronization.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">1. Commit Changes</p>
                <div className="bg-black/50 p-4 rounded-xl border border-slate-700 font-mono text-xs text-blue-300">
                  <p>npm run git:commit</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-slate-500">2. Force Push (Detached HEAD Fix)</p>
                <div className="bg-black/50 p-4 rounded-xl border border-slate-700 font-mono text-xs text-amber-300">
                  <p>git push origin HEAD:main</p>
                </div>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex gap-3 text-xs text-blue-200">
                <Info className="w-5 h-5 shrink-0" />
                <p>Use your GitHub <strong>Personal Access Token (PAT)</strong> as the password when prompted in the terminal.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-100 bg-red-50/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Fix Authentication Errors
            </CardTitle>
            <CardDescription>Resolve "Invalid username or token" and ECONNREFUSED errors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-red-900">Step 1: Clear Broken Credential Socket</p>
              <div className="bg-white p-3 rounded-lg border border-red-200 font-mono text-[10px] text-red-900">
                git config --global --unset credential.helper
              </div>
              <p className="text-[9px] text-red-700 italic">This fixes ECONNREFUSED by forcing a direct password prompt.</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-red-900">Step 2: Generate GitHub PAT</p>
              <p className="text-[10px] text-red-800">
                Go to GitHub Settings &rarr; Developer Settings &rarr; Personal Access Tokens (Classic) &rarr; Generate New Token.
                Select the <strong>'repo'</strong> scope.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase text-red-900">Step 3: Push with Token</p>
              <p className="text-[10px] text-red-800">
                Run the push command again. When it asks for your password, <strong>paste the token</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
