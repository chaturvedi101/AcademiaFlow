'use client';

import { useState, useEffect } from 'react';
import { listAvailableModels } from '@/ai/flows/list-models-flow';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, RefreshCw, Cpu, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ success: boolean; models?: any[]; error?: string } | null>(null);

  const fetchModels = async () => {
    setLoading(true);
    const result = await listAvailableModels();
    setData(result);
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
          Refresh Models
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Connection Status</CardTitle>
            <CardDescription>System health check</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Pinging Google AI Studio...</span>
              </div>
            ) : data?.success ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-bold">Connected</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Your API key is valid and the Genkit provider is initialized correctly.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-bold">Error</span>
                </div>
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-800 font-mono">
                  {data?.error || "Unknown initialization error"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Check your .env file and ensure GOOGLE_GENAI_API_KEY is correct.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Available Models</CardTitle>
            <CardDescription>Models reported by the Google AI plugin</CardDescription>
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
                        <p className="text-[10px] text-muted-foreground">Supported: {model.info?.supports?.join(', ') || 'N/A'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {model.name.includes('flash') ? 'Fast' : 'Stable'}
                    </Badge>
                  </div>
                ))}
                {!loading && (!data?.models || data.models.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Cpu className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>No models returned from API.</p>
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
