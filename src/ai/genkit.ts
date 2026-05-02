
import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/googleai';

/**
 * Global Genkit instance configured for Google AI.
 * Uses Gemini 1.5 Flash as the default model.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
