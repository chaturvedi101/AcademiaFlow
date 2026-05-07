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
      // v1beta is used to ensure full support for structured output and responseMimeType
      apiVersion: 'v1beta',
    }),
  ],
  // Standardized on the recommended gemini-2.5-flash model
  model: 'googleai/gemini-2.5-flash',
});
