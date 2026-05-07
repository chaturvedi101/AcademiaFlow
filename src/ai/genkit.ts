/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * Standardized on Gemini 2.5 Flash and v1beta for robust JSON support.
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
      // v1beta is required for stable support of responseMimeType/structured output with Genkit 1.x
      apiVersion: 'v1beta',
    }),
  ],
  // Standardized default model for the app to prevent "Must supply a model" errors
  model: 'googleai/gemini-2.5-flash',
});
