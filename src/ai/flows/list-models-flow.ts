
'use server';
/**
 * @fileOverview Flow to list available AI models using the Genkit 1.x registry.
 */

import { ai } from '@/ai/genkit';

export async function listAvailableModels() {
  try {
    // In Genkit 1.x, registered models are part of the actions in the registry
    const actions = ai.registry.listActions();
    const models = actions.filter(action => action.key.includes('/'));
    
    if (models.length === 0) {
      // Fallback: Check if we can at least ping the provider
      const testResponse = await ai.generate({
        model: 'googleai/gemini-1.5-flash',
        prompt: 'Connectivity check. Reply with "ok".',
        config: { maxOutputTokens: 5 }
      });
      
      if (testResponse.text) {
        return {
          success: true,
          models: [{ name: 'googleai/gemini-1.5-flash', info: { supports: ['text'] } }],
          note: 'Connection verified via fallback ping.'
        };
      }
    }

    return {
      success: true,
      models: models.map(m => ({
        name: m.key,
        info: m.metadata || {}
      }))
    };
  } catch (error: any) {
    console.error('Genkit diagnostics error:', error);
    return {
      success: false,
      error: error.message || 'Unknown connection error during AI diagnostics.'
    };
  }
}
