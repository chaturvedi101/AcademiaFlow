import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

/**
 * Global Genkit instance configured for Google AI.
 * Standardized initialization for Genkit 1.x.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
