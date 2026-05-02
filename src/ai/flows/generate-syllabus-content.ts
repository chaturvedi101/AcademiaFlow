
'use server';
/**
 * @fileOverview AI flow for generating academic syllabus structures.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SyllabusUnitSchema = z.object({
  title: z.string().describe('Unit title'),
  content: z.string().describe('Unit topics and details'),
  courseOutcome: z.string().describe('Specific learning outcome for this unit'),
});

const GenerateSyllabusContentInputSchema = z.object({
  subjectTitle: z.string(),
  keywords: z.array(z.string()).optional(),
});

const GenerateSyllabusContentOutputSchema = z.object({
  units: z.array(SyllabusUnitSchema).length(5).describe('Exactly 5 academic units'),
  suggestedResources: z.array(z.string()).describe('Recommended textbooks or URLs'),
});

export type GenerateSyllabusContentInput = z.infer<typeof GenerateSyllabusContentInputSchema>;
export type GenerateSyllabusContentOutput = z.infer<typeof GenerateSyllabusContentOutputSchema>;

const syllabusPrompt = ai.definePrompt({
  name: 'syllabusPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: { schema: GenerateSyllabusContentInputSchema },
  output: { schema: GenerateSyllabusContentOutputSchema },
  config: {
    temperature: 0.7,
  },
  prompt: `You are an expert academic curriculum designer for a technical university following NEP 2020 guidelines.
  
Generate a comprehensive syllabus for the course: "{{{subjectTitle}}}".

Contextual Keywords: {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Requirements:
1. Provide exactly 5 units.
2. For each unit, write a professional title and a list of topics.
3. Each unit must have one high-level Course Outcome (CO) using Bloom's Taxonomy verbs (e.g., "Analyze", "Design", "Evaluate").
4. Suggest 3-5 standard academic resources.`,
});

export async function generateSyllabusContent(input: GenerateSyllabusContentInput): Promise<GenerateSyllabusContentOutput> {
  try {
    if (!process.env.GOOGLE_GENAI_API_KEY) {
      throw new Error('GOOGLE_GENAI_API_KEY is missing. Please add it to your .env file.');
    }
    const { output } = await syllabusPrompt(input);
    if (!output) {
      throw new Error('AI returned empty output. This may be due to safety filters or an invalid API key.');
    }
    return output;
  } catch (error: any) {
    // Log the error for developer reference but throw a clean message for the UI
    const message = error.message?.includes('API_KEY_INVALID') 
      ? 'The API key provided is invalid or expired. Please update your .env file.' 
      : error.message || 'AI failed to generate syllabus content.';
    throw new Error(message);
  }
}
