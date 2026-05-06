
'use server';
/**
 * @fileOverview Flow to verify AI connectivity and list registered model actions using Genkit 1.x Registry.
 */

import { ai } from '@/ai/genkit';

export async function listAvailableModels() {
  try {
    // Connectivity check via a simple generation using Gemini 2.0 Flash
    const ping = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
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
        : [{ name: 'googleai/gemini-2.0-flash', info: { supports: ['text'] } }],
      note: 'Connectivity verified successfully via Gemini 2.0 Flash.',
      response: ping.text
    };
  } catch (error: any) {
    console.error('AI Diagnostics Failed:', error);
    
    let userMessage = error.message || 'Unknown error during AI diagnostics.';
    if (userMessage.includes('429') || userMessage.includes('RESOURCE_EXHAUSTED')) {
      userMessage = "Quota Exceeded (429): You have reached your API rate limit. Please check your billing/usage in Google AI Studio.";
    }

    return {
      success: false,
      error: userMessage,
      details: error.stack
    };
  }
}
