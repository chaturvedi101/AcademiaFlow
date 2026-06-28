'use client';

import { useState, useEffect } from 'react';
import { listAvailableModels } from '@/ai/flows/list-models-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Cpu, AlertCircle, CheckCircle2, ExternalLink, Sparkles, Info, ShieldAlert } from 'lucide-react';

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ 
    success: boolean; 
    hasKey: boolean;
    models?: any[]; 
    error?: string; 
    isQuotaError?: boolean;
    isPermissionError?: boolean;
    provider?: string;
    response?: string;
  } | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    const result = await listAvailableModels();
    setData(result as any);
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold">AI Diagnostics</h1>
          <p className="text-muted-foreground">Verify institutional AI connectivity and monitor API quota status.</p>
        </div>
        <Button onClick={fetchModels} disabled={loading} className="gap-2 shadow-sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Connectivity
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-6">
          <Card className="h-fit border-primary/10 bg-gradient-to-br from-white to-primary/5 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                AI Health Status
              </CardTitle>
              <CardDescription>Gemini API Integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">API Environment</span>
                  <div className="flex items-center gap-2">
                    {data?.hasKey ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Authorized</Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Unauthorized (No Key)</Badge>
                    )}
                  </div>
                </div>

                {loading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4 bg-muted/20 rounded-xl px-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Pinging Gemini...</span>
                  </div>
                ) : data?.success ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600 p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="font-bold">Operational</span>
                    </div>
                    <div className="p-3 bg-white border rounded-lg space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">Response Preview</p>
                      <p className="text-xs font-mono text-primary italic">"{data.response}"</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-5 h-5" />
                      <span className="font-bold text-sm">
                        {data?.isQuotaError ? "Institutional Rate Limit" : "Connection Failure"}
                      </span>
                    </div>
                    <div className={`p-4 border rounded-xl text-[10px] font-mono leading-tight shadow-inner ${
                      data?.isQuotaError ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-red-50 border-red-100 text-red-800'
                    }`}>
                      {data?.error || "Unknown system initialization error"}
                    </div>
                    {data?.isQuotaError && (
                      <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-[10px] text-blue-800 space-y-2">
                        <p className="font-bold flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Rate Limit Explanation:</p>
                        <p className="leading-relaxed">
                          Your **Gemini API Key** (Free Tier) is limited to 15 requests per minute. 
                          If this limit is reached, you can switch to **Gemini Pro** in the Syllabus Architect to bypass the immediate Flash model bottleneck.
                        </p>
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="w-full gap-2 text-[10px] h-10" asChild>
                      <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" /> Manage Keys in AI Studio
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/10 bg-accent/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-accent" />
                Internal Usage FAQ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold">Is the key always active?</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  No. The system only triggers your Gemini API key when you explicitly click AI buttons. Standard operations (Syllabus entry, Scheme creation, PDF exports) do not consume quota.
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-bold">Can I bypass rate limits?</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Yes. If one model (Flash) is busy, you can select Gemini Pro in the Course Architect to use a different processing pool.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="md:col-span-2 shadow-md">
          <CardHeader className="border-b pb-4 bg-muted/10">
            <CardTitle className="text-lg">AI Model Registry</CardTitle>
            <CardDescription>Institutional model capabilities for curriculum design</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <ScrollArea className="h-[450px] pr-4">
              <div className="space-y-3">
                {data?.models?.map((model: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-full bg-primary/5 group-hover:bg-primary/10">
                        <Cpu className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-mono font-bold text-foreground">{model.name}</p>
                        <p className="text-[10px] text-muted-foreground">Supported Modalities: {model.info?.supports?.join(', ') || 'text generation'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-primary/5 text-primary border-none font-black tracking-tight">
                      {model.name.includes('flash') ? 'HIGH-SPEED' : 'REASONING-CORE'}
                    </Badge>
                  </div>
                ))}
                {!loading && (!data?.models || data.models.length === 0) && !data?.success && (
                  <div className="text-center py-20 text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/30">
                    <AlertCircle className="w-10 h-10 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium">Model registry restricted due to active rate limiting.</p>
                    <p className="text-[10px] mt-1 opacity-60">Wait 60 seconds and refresh.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
