import { gemini15Flash, googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

/**
 * Global Genkit instance configured for Google AI.
 * Uses Gemini 1.5 Flash as the default model.
 * Using the latest @genkit-ai/google-genai plugin for better stability.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
