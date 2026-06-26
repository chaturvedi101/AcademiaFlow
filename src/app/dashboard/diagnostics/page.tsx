'use client';

import { useState, useEffect } from 'react';
import { listAvailableModels } from '@/ai/flows/list-models-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Cpu, AlertCircle, CheckCircle2, ExternalLink, Clock, ShieldAlert } from 'lucide-react';

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ 
    success: boolean; 
    models?: any[]; 
    error?: string; 
    isQuotaError?: boolean;
    isPermissionError?: boolean;
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
          <p className="text-muted-foreground">Verify available models and API connectivity.</p>
        </div>
        <Button onClick={fetchModels} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh Health Check
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">System Health</CardTitle>
            <CardDescription>Connectivity & API Status</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pinging Google AI Studio...</span>
              </div>
            ) : data?.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">API Operational</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-800">
                  Successfully connected to Gemini models. Structured generation is ready.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  {data?.isPermissionError ? <ShieldAlert className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="font-bold">
                    {data?.isQuotaError ? "Quota Reached" : data?.isPermissionError ? "Access Forbidden" : "Connection Error"}
                  </span>
                </div>
                <div className={`p-3 border rounded-lg text-xs font-mono ${
                  data?.isQuotaError ? 'bg-amber-50 border-amber-100 text-amber-800' : 'bg-red-50 border-red-100 text-red-800'
                }`}>
                  {data?.error || "Unknown initialization error"}
                </div>
                {data?.isPermissionError && (
                  <div className="flex items-start gap-2 p-3 bg-red-100/50 rounded-lg text-[10px] text-red-900">
                    <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    <p>Your Google Cloud project or API key has been denied access. This usually happens if the project is disabled or flagged. Please check your credentials.</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="w-full gap-2 text-[10px]" asChild>
                  <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3 h-3" /> Check Google AI Studio
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Model Registry</CardTitle>
            <CardDescription>Models active in the current session</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {data?.models?.map((model: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-4 h-4 text-primary" />
                      <div>
                        <p className="text-sm font-mono font-bold">{model.name}</p>
                        <p className="text-[10px] text-muted-foreground">Capabilities: {model.info?.supports?.join(', ') || 'text'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] bg-primary/5 text-primary border-none">
                      {model.name.includes('flash') ? 'Performance' : 'Reasoning'}
                    </Badge>
                  </div>
                ))}
                {!loading && (!data?.models || data.models.length === 0) && !data?.success && (
                  <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">Models unavailable due to connection failure.</p>
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
