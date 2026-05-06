
/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * This file is server-side only to avoid browser compatibility issues with OpenTelemetry.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

const apiKey = process.env.GOOGLE_GENAI_API_KEY;

if (!apiKey || apiKey === 'REPLACE_WITH_YOUR_NEW_API_KEY') {
  console.warn('AI functionality is disabled: GOOGLE_GENAI_API_KEY is missing or invalid.');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
    }),
  ],
});
