'use server';
/**
 * @fileOverview Flow to verify AI connectivity and list registered model actions.
 */

import { ai } from '@/ai/genkit';

export async function listAvailableModels() {
  try {
    // Verify connection via Gemini 2.5 Flash
    const ping = await ai.generate({
      model: 'googleai/gemini-2.5-flash',
      prompt: 'Verify connection. Reply with "OK".',
      config: { maxOutputTokens: 5 }
    });

    // Get actions from registry using correct 1.x API
    const actions = ai.registry.listActions();
    const modelActions = actions.filter(a => a.key.includes('/model/'));

    return {
      success: true,
      models: modelActions.length > 0 
        ? modelActions.map(m => ({ name: m.key, info: { supports: ['text'] } }))
        : [{ name: 'googleai/gemini-2.5-flash', info: { supports: ['text'] } }],
      note: 'Connectivity verified via Gemini 2.5 Flash (v1beta).',
      response: ping.text
    };
  } catch (error: any) {
    console.error('AI Diagnostics Failed:', error);
    
    let userMessage = error.message || 'Unknown error during AI diagnostics.';
    if (userMessage.includes('429') || userMessage.includes('RESOURCE_EXHAUSTED')) {
      userMessage = "Quota Exceeded (429): Please wait a minute before retrying.";
    }

    return {
      success: false,
      error: userMessage,
      details: error.stack
    };
  }
}
