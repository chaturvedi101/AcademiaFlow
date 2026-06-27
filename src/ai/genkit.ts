/**
 * @fileOverview Genkit configuration for Academic AI Architect.
 * Standardized on Gemini Flash with automatic API key detection.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { genkit } from 'genkit';

/**
 * Initialize Genkit.
 * Note: We don't explicitly pass the apiKey here.
 * Genkit will automatically look for GOOGLE_GENAI_API_KEY or GEMINI_API_KEY 
 * in the environment variables (standard for Firebase App Hosting).
 */
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  // Use the standard stable alias for Gemini Flash
  model: googleAI.model('gemini-flash-latest'),
});

export { z } from 'genkit';
