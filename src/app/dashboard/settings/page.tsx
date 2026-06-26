
'use client';

import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Github, Globe, ShieldCheck, User, Code, Info, Terminal, ExternalLink, AlertTriangle, Key, Zap, CheckCircle2, RefreshCw, Coins, HardDriveDownload, Activity, CreditCard, ShieldAlert } from 'lucide-react';

export default function SettingsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">System Settings</h1>
        <p className="text-muted-foreground">Manage your account and institutional connectivity.</p>
      </div>

      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-2' : ''} gap-8`}>
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

        {isAdmin && (
          <Card className="border-emerald-100 bg-emerald-50/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <Coins className="w-5 h-5" />
                Institutional FinOps
              </CardTitle>
              <CardDescription>Active measures to keep RTU hosting costs near zero.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white border rounded-lg text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Min Instances</p>
                  <p className="text-lg font-bold text-emerald-600">0</p>
                  <p className="text-[8px] text-muted-foreground">Zero cost when idle</p>
                </div>
                <div className="p-3 bg-white border rounded-lg text-center">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Max Instances</p>
                  <p className="text-lg font-bold text-red-600">1</p>
                  <p className="text-[8px] text-muted-foreground">Anti-bill-shock cap</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase text-primary tracking-widest">Cost Efficiency Checklist</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><b>Auto-Timeout:</b> Real-time database listeners stop after 5 mins of inactivity.</span>
                  </li>
                  <li className="flex items-start gap-2 text-[10px] text-muted-foreground">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span><b>AI Quota:</b> Using Gemini Flash (15 req/min) on the Free tier.</span>
                  </li>
                </ul>
              </div>

              <Button variant="outline" size="sm" className="w-full gap-2 border-primary/20 text-primary" asChild>
                <a href="https://console.firebase.google.com/project/_/usage/details" target="_blank" rel="noopener noreferrer">
                  <CreditCard className="w-3.5 h-3.5" /> Set Budget Alerts
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-accent/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-accent">
                <Github className="w-5 h-5" />
                Institutional Sync Guide
              </CardTitle>
              <CardDescription>Resolve common terminal and authentication issues.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-xs text-amber-800">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-bold">Socket Error (ECONNREFUSED)?</p>
                  <p>Run <b>git config --global --unset credential.helper</b> to reset broken terminal credentials.</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase text-muted-foreground">The Nuclear Option (Direct Token Sync)</p>
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border font-mono text-[9px] break-all">
                  <Globe className="w-3.5 h-3.5 text-accent shrink-0" />
                  git remote set-url origin https://[YOUR_PAT_TOKEN]@github.com/chaturvedi101/AcademiaFlow.git
                </div>
                <p className="text-[10px] text-muted-foreground italic mt-1">Requires 'repo' scope permissions on your GitHub token.</p>
              </div>

              <Button variant="outline" className="w-full h-11 gap-2 border-dashed" asChild>
                <a href="https://github.com/chaturvedi101/AcademiaFlow" target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" /> Open GitHub Repository
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-slate-900 text-white border-none shadow-xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Terminal className="w-32 h-32" />
            </div>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Code className="w-5 h-5" />
                Sync Command Matrix
              </CardTitle>
              <CardDescription className="text-slate-400">Final commands for university deployment.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500">1. Commit All Changes</p>
                  <div className="bg-black/50 p-4 rounded-xl border border-slate-700 font-mono text-xs text-emerald-400">
                    <p>git add . && git commit -m "Final Institutional Commit"</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase text-slate-500">2. Force Push to Main</p>
                  <div className="bg-black/50 p-4 rounded-xl border border-slate-700 font-mono text-xs text-blue-300">
                    <p>git push origin HEAD:main --force</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
