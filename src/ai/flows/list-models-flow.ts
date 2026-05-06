
'use server';
/**
 * @fileOverview Flow to verify AI connectivity and list registered model actions using Genkit 1.x Registry.
 */

import { ai } from '@/ai/genkit';

export async function listAvailableModels() {
  try {
    // connectivity check via a simple generation using the latest identifier
    // Using v1 API explicitly via config in genkit.ts
    const ping = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Verify connection. Reply with "OK".',
      config: { maxOutputTokens: 5 }
    });

    // Get actions from registry to show what's loaded
    const actions = ai.registry.listActions();
    const modelActions = actions.filter(a => a.key.includes('/model/'));

    return {
      success: true,
      models: modelActions.length > 0 
        ? modelActions.map(m => ({ name: m.key, info: { supports: ['text'] } }))
        : [{ name: 'googleai/gemini-1.5-flash', info: { supports: ['text'] } }],
      note: 'Connectivity verified successfully via v1 API.',
      response: ping.text
    };
  } catch (error: any) {
    console.error('AI Diagnostics Failed:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during AI diagnostics.',
      details: error.stack
    };
  }
}
