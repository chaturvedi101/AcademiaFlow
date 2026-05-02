import { config } from 'dotenv';
config();

import '@/ai/flows/generate-syllabus-content.ts';
import '@/ai/flows/suggest-program-outcomes.ts';
import '@/ai/flows/suggest-nep-categories.ts';

// Example test flow as per user reference
import { ai } from '@/ai/genkit';
ai.defineFlow('helloFlow', async (name) => {
  const { text } = await ai.generate(`Hello Gemini, my name is ${name}`);
  console.log(text);
  return text;
});
