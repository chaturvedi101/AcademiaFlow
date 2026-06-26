'use client';

import { useState, useEffect } from 'react';
import { listAvailableModels } from '@/ai/flows/list-models-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Cpu, AlertCircle, CheckCircle2, ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';

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
          <p className="text-muted-foreground">Confirm usage and verify API connectivity for Academic Architect features.</p>
        </div>
        <Button onClick={fetchModels} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Connectivity
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI Status
            </CardTitle>
            <CardDescription>Usage and Key Verification</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">AI Integrated:</span>
              <Badge className="bg-emerald-100 text-emerald-700 border-none">YES</Badge>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-muted-foreground uppercase">Environment Variable</span>
                <div className="flex items-center gap-2">
                  {data?.hasKey ? (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-200">API Key Detected</Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-200">Key Not Found</Badge>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Pinging Gemini...</span>
                </div>
              ) : data?.success ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold">Operational</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Successfully connected to {data.provider}. Syllabus generation is active.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-red-600">
                    {data?.isPermissionError ? <AlertCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-bold text-sm">
                      {data?.isQuotaError ? "Rate Limit Reached" : "Connection Error"}
                    </span>
                  </div>
                  <div className={`p-3 border rounded-lg text-[10px] font-mono leading-tight ${
                    data?.isQuotaError ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-red-50 border-red-100 text-red-800'
                  }`}>
                    {data?.error || "Unknown initialization error"}
                  </div>
                  {data?.isQuotaError && (
                    <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-800">
                      <p className="font-bold mb-1">Billing Clarification:</p>
                      The 429 error refers to your <strong>Gemini API Key</strong> usage in Google AI Studio, not your Firebase Blaze plan. Free tier keys are limited to 15 requests per minute.
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full gap-2 text-[10px]" asChild>
                    <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-3 h-3" /> Upgrade in AI Studio
                    </a>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">AI Model Registry</CardTitle>
            <CardDescription>Available Gemini models for curriculum design</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px] pr-4">
              <div className="space-y-2">
                {data?.models?.map((model: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-mono font-bold">{model.name}</p>
                        <p className="text-[10px] text-muted-foreground">Capabilities: {model.info?.supports?.join(', ') || 'text generation'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-primary/5 text-primary border-none">
                      {model.name.includes('flash') ? 'Fast' : 'Reasoning'}
                    </Badge>
                  </div>
                ))}
                {!loading && (!data?.models || data.models.length === 0) && !data?.success && (
                  <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Model data restricted due to rate limiting.</p>
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
