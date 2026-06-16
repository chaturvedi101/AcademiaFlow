'use server';
/**
 * @fileOverview Flow to verify AI connectivity and list registered model actions.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';

export async function listAvailableModels() {
  try {
    // Verify connection via Gemini Flash
    const ping = await ai.generate({
      model: googleAI.model('gemini-1.5-flash'),
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
        : [{ name: 'googleai/gemini-1.5-flash', info: { supports: ['text'] } }],
      note: 'Connectivity verified via Gemini Flash.',
      response: ping.text
    };
  } catch (error: any) {
    console.error('AI Diagnostics Failed:', error);
    
    let userMessage = error.message || 'Unknown error during AI diagnostics.';
    let quotaError = false;

    if (
      userMessage.includes('429') || 
      userMessage.includes('RESOURCE_EXHAUSTED') || 
      userMessage.toLowerCase().includes('quota') ||
      userMessage.toLowerCase().includes('rate limit')
    ) {
      userMessage = "Quota Exceeded (429): You have reached the request limit for the Gemini free tier. Please wait at least 60 seconds before retrying.";
      quotaError = true;
    }

    return {
      success: false,
      error: userMessage,
      isQuotaError: quotaError,
      details: error.stack
    };
  }
}
