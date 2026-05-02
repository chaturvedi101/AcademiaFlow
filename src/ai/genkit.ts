import { gemini15Flash, googleAI } from '@genkit-ai/googleai';
import { genkit } from 'genkit';

/**
 * Global Genkit instance configured for Google AI.
 * Uses Gemini 1.5 Flash as the default model.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
