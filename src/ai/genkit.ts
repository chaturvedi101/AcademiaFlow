import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

/**
 * Global Genkit instance configured for Google AI.
 * Model identifiers are specified at the prompt/generate level for clarity.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
