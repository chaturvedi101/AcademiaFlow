'use client';
/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_GENAI_API_KEY,
    }),
  ],
});
