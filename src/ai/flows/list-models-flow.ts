'use server';
/**
 * @fileOverview Flow to list available AI models for diagnostics.
 */

import { ai } from '@/ai/genkit';

export async function listAvailableModels() {
  try {
    const models = await ai.listModels();
    return {
      success: true,
      models: models.map(m => ({
        name: m.name,
        info: m.info
      }))
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}
