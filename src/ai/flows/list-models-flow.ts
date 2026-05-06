
'use server';
/**
 * @fileOverview Flow to list available AI models for diagnostics.
 */

import { ai } from '@/ai/genkit';

export async function listAvailableModels() {
  try {
    // Attempt to list models to verify API connectivity
    const models = await ai.listModels();
    
    if (!models || models.length === 0) {
      throw new Error('No models returned from Google AI. Check if your API key has the necessary permissions.');
    }

    return {
      success: true,
      models: models.map(m => ({
        name: m.name,
        info: m.info
      }))
    };
  } catch (error: any) {
    console.error('Genkit listModels error:', error);
    return {
      success: false,
      error: error.message || 'Unknown connection error'
    };
  }
}
