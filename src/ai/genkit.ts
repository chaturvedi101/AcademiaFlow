/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * This file is server-side only.
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
      apiVersion: 'v1',
    }),
  ],
  model: 'googleai/gemini-2.0-flash', // Setting a robust default model
});
