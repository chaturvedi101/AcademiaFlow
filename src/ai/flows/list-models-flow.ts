'use server';
/**
 * @fileOverview Flow to verify AI connectivity and list registered model actions.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';

export async function listAvailableModels() {
  const hasKey = !!(process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY);
  
  try {
    // Verify connection via Gemini Flash alias
    const ping = await ai.generate({
      model: googleAI.model('gemini-flash-latest'),
      prompt: 'Verify connection. Reply with "OK".',
      config: { maxOutputTokens: 5 }
    });

    // Get actions from registry using correct 1.x API
    const actions = await ai.registry.listActions();
    
    // Safety check: ensure actions is an array before filtering
    const modelActions = Array.isArray(actions) 
      ? actions.filter(a => a.key.includes('/model/'))
      : [];

    return {
      success: true,
      hasKey,
      models: modelActions.length > 0 
        ? modelActions.map(m => ({ name: m.key, info: { supports: ['text'] } }))
        : [{ name: 'googleai/gemini-flash-latest', info: { supports: ['text'] } }],
      note: 'Connectivity verified via Gemini Flash Latest alias.',
      response: ping.text,
      provider: 'Google AI Studio (Gemini API)'
    };
  } catch (error: any) {
    console.error('AI Diagnostics Failed:', error);
    
    let userMessage = error.message || 'Unknown error during AI diagnostics.';
    let isPermissionError = false;
    let quotaError = false;

    if (userMessage.includes('403') || userMessage.includes('PERMISSION_DENIED') || userMessage.includes('denied access')) {
      userMessage = "Access Denied (403): Your API key project is restricted or invalid. Check Google AI Studio.";
      isPermissionError = true;
    } else if (
      userMessage.includes('429') || 
      userMessage.includes('RESOURCE_EXHAUSTED') || 
      userMessage.toLowerCase().includes('quota') ||
      userMessage.toLowerCase().includes('rate limit')
    ) {
      userMessage = "Quota Exceeded (429): Rate limit reached for your Gemini API key.";
      quotaError = true;
    } else if (userMessage.toLowerCase().includes('fetch failed')) {
      userMessage = "Network Failure: Could not reach Google AI services. Check your internet or proxy settings.";
    }

    return {
      success: false,
      hasKey,
      error: userMessage,
      isQuotaError: quotaError,
      isPermissionError: isPermissionError,
      details: error.stack,
      provider: 'Google AI Studio (Gemini API)'
    };
  }
}
