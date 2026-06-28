
'use client';

import { useState, useEffect } from 'react';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { UserProfile, AppHostingConfig } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Github, Globe, ShieldCheck, User, Code, Terminal, ExternalLink, 
  Cpu, Save, RefreshCw, Coins, CreditCard, ShieldAlert, Activity, FileCode, Info 
} from 'lucide-react';

export default function SettingsPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  
  const userDocRef = useMemoFirebase(() => (user ? doc(db, 'users', user.uid) : null), [db, user]);
  const { data: profile } = useDoc<UserProfile>(userDocRef);

  const configDocRef = useMemoFirebase(() => doc(db, 'system_config', 'apphosting'), [db]);
  const { data: storedConfig, loading: configLoading } = useDoc<AppHostingConfig>(configDocRef);

  const [config, setConfig] = useState<AppHostingConfig>({
    minInstances: 0,
    maxInstances: 1,
    memory: '512Mi',
    cpu: 1,
    concurrency: 80
  });

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (storedConfig) {
      setConfig(storedConfig);
    }
  }, [storedConfig]);

  const isAdmin = profile?.role === 'admin';

  const handleSaveConfig = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      await setDoc(configDocRef, {
        ...config,
        updatedAt: serverTimestamp(),
        updatedBy: user?.email
      }, { merge: true });
      toast({ title: "Infrastructure Policy Updated", description: "Target settings registered in Firestore." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Save Failed", description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const yamlContent = `# Settings to manage and configure a Firebase App Hosting backend.
# https://firebase.google.com/docs/app-hosting/configure

runConfig:
  # Minimizes cost by spinning down to 0 when idle
  minInstances: ${config.minInstances}
  # Prevents runaway scaling costs by capping at 1 instance
  maxInstances: ${config.maxInstances}
  # Efficient memory allocation for Next.js 15
  memory: ${config.memory}
  cpu: ${config.cpu}
  # Allows one instance to handle up to ${config.concurrency} concurrent users
  concurrency: ${config.concurrency}`;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-headline font-bold text-primary">System Settings</h1>
        <p className="text-muted-foreground">Manage your account and institutional connectivity.</p>
      </div>

      <Tabs defaultValue="account" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6">
          <TabsTrigger value="account" className="gap-2"><User className="w-4 h-4" /> Account</TabsTrigger>
          {isAdmin && <TabsTrigger value="infrastructure" className="gap-2"><Activity className="w-4 h-4" /> Infrastructure & FinOps</TabsTrigger>}
          {isAdmin && <TabsTrigger value="sync" className="gap-2"><RefreshCw className="w-4 h-4" /> Institutional Sync</TabsTrigger>}
        </TabsList>

        <TabsContent value="account">
          <Card className="border-primary/10 max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Institutional Authorization
              </CardTitle>
              <CardDescription>Your current account identity and assigned jurisdiction.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl">
                <div className="bg-primary/10 p-3 rounded-full">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-bold">{profile?.displayName}</p>
                  <p className="text-xs text-muted-foreground">{profile?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Primary Role</p>
                  <Badge variant="secondary" className="uppercase text-[10px] font-bold px-3 py-1 bg-primary/5 text-primary border-none">
                    {profile?.role?.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Faculty Assignment</p>
                  <p className="text-xs font-medium">{profile?.faculty || 'Department-specific'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="infrastructure" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 border-emerald-100 bg-emerald-50/10">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2 text-emerald-800">
                        <Coins className="w-5 h-5" />
                        FinOps & Performance Control
                      </CardTitle>
                      <CardDescription>Configure target institutional hosting parameters.</CardDescription>
                    </div>
                    <Button onClick={handleSaveConfig} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                      {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Target Policy
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold uppercase">Min Instances</Label>
                          <Badge variant="outline" className="font-mono">{config.minInstances}</Badge>
                        </div>
                        <Slider 
                          value={[config.minInstances]} 
                          max={10} 
                          step={1} 
                          onValueChange={([v]) => setConfig({...config, minInstances: v})}
                        />
                        <p className="text-[10px] text-muted-foreground">Keep at 0 for "Pay-as-you-go" zero-cost when idle.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold uppercase">Max Instances</Label>
                          <Badge variant="outline" className="font-mono text-red-600">{config.maxInstances}</Badge>
                        </div>
                        <Slider 
                          value={[config.maxInstances]} 
                          min={1}
                          max={100} 
                          step={1} 
                          onValueChange={([v]) => setConfig({...config, maxInstances: v})}
                        />
                        <p className="text-[10px] text-muted-foreground text-red-600/70 font-bold">Anti-Bill-Shock: Limits the peak concurrent capacity.</p>
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase">Memory Allocation</Label>
                        <Select value={config.memory} onValueChange={(v: any) => setConfig({...config, memory: v})}>
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="256Mi">256 MiB (Light)</SelectItem>
                            <SelectItem value="512Mi">512 MiB (Standard)</SelectItem>
                            <SelectItem value="1Gi">1 GiB (Heavy)</SelectItem>
                            <SelectItem value="2Gi">2 GiB (Extreme)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <Label className="text-xs font-bold uppercase">CPU Cores</Label>
                        <Select value={String(config.cpu)} onValueChange={(v) => setConfig({...config, cpu: Number(v)})}>
                          <SelectTrigger className="h-10 bg-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 Core (Default)</SelectItem>
                            <SelectItem value="2">2 Cores (Parallel)</SelectItem>
                            <SelectItem value="4">4 Cores (Compute Intense)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-bold uppercase">User Concurrency</Label>
                          <Badge variant="outline" className="font-mono">{config.concurrency}</Badge>
                        </div>
                        <Slider 
                          value={[config.concurrency]} 
                          min={1}
                          max={80} 
                          step={1} 
                          onValueChange={([v]) => setConfig({...config, concurrency: v})}
                        />
                        <p className="text-[10px] text-muted-foreground">Max users per instance before scaling. Standard is 80.</p>
                      </div>
                      
                      <div className="p-4 bg-white border border-emerald-100 rounded-xl space-y-2">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase flex items-center gap-1.5">
                          <Info className="w-3.5 h-3.5" /> Registry Status
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Last Updated: {storedConfig?.updatedAt?.toDate().toLocaleString() || 'Never'}<br/>
                          By: {storedConfig?.updatedBy || 'System'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-100 bg-blue-50/10">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-blue-800">
                    <FileCode className="w-5 h-5" />
                    apphosting.yaml
                  </CardTitle>
                  <CardDescription>Live Generated Configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-slate-900 rounded-xl p-4 overflow-hidden relative group">
                    <pre className="text-[10px] text-blue-300 font-mono leading-relaxed">
                      {yamlContent}
                    </pre>
                    <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-white/50 hover:text-white" onClick={() => {
                      navigator.clipboard.writeText(yamlContent);
                      toast({ title: "Copied to Clipboard" });
                    }}>
                      Copy
                    </Button>
                  </div>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-[10px] text-amber-800">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <p><b>Note:</b> Saving changes here only updates the Firestore registry. To apply these to the cloud server, copy this code to your local file and redeploy via Git.</p>
                  </div>
                  <Button variant="outline" className="w-full border-blue-200 text-blue-800 gap-2" asChild>
                    <a href="https://console.firebase.google.com/project/_/apphosting" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" /> Open App Hosting Console
                    </a>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="sync">
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
                        <p>git add . && git commit -m "Apply Performance Policy"</p>
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
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
