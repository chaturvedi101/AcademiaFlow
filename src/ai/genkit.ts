/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * Standardized on Gemini Flash with robust API key detection.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

// Check for common API key environment variable names
const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn('AI functionality is disabled: Neither GOOGLE_GENAI_API_KEY nor GEMINI_API_KEY is found in environment variables.');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
      // v1beta is recommended for stable support of structured output and newer models
      apiVersion: 'v1beta',
    }),
  ],
  // Use the standard stable alias for Gemini Flash
  model: googleAI.model('gemini-flash-latest'),
});

export { z } from 'genkit';
