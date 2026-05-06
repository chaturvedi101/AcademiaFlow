
/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * This file is server-side only to avoid browser compatibility issues with Node.js modules like async_hooks.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

const apiKey = process.env.GOOGLE_GENAI_API_KEY;

if (!apiKey) {
  console.warn('AI functionality is disabled: GOOGLE_GENAI_API_KEY is missing.');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
});
