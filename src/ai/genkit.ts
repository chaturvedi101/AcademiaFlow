/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * This file is server-side only to avoid browser compatibility issues with OpenTelemetry.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY,
    }),
  ],
});
