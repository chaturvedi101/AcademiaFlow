'use server';
/**
 * @fileOverview An AI assistant flow for generating initial drafts of syllabus content with units.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateSyllabusContentInputSchema = z.object({
  subjectTitle: z
    .string()
    .describe('The title of the subject for which to generate content.'),
  keywords: z
    .array(z.string())
    .describe('Keywords related to the subject to guide content generation.'),
});
export type GenerateSyllabusContentInput = z.infer<
  typeof GenerateSyllabusContentInputSchema
>;

const SyllabusUnitSchema = z.object({
  title: z.string().describe('Brief title of the unit.'),
  content: z.string().describe('Detailed topics and syllabus content for this unit.'),
  courseOutcome: z.string().describe('A learning outcome for this specific unit (e.g., "Students will be able to...").'),
});

const GenerateSyllabusContentOutputSchema = z.object({
  subjectDescription: z
    .string()
    .describe('A brief, concise description of the subject.'),
  units: z
    .array(SyllabusUnitSchema)
    .describe('A list of exactly 5 units for the syllabus.'),
  learningResources: z
    .array(z.string())
    .describe(
      'A list of 3-5 recommended learning resources (e.g., textbooks, online courses).'
    ),
});
export type GenerateSyllabusContentOutput = z.infer<
  typeof GenerateSyllabusContentOutputSchema
>;

export async function generateSyllabusContent(
  input: GenerateSyllabusContentInput
): Promise<GenerateSyllabusContentOutput> {
  return generateSyllabusContentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateSyllabusContentPrompt',
  input: { schema: GenerateSyllabusContentInputSchema },
  output: { schema: GenerateSyllabusContentOutputSchema },
  config: {
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `You are an expert academic content creator specializing in technical university curriculum development following NEP 2020 guidelines.
  
Generate a professional subject description, 5 detailed units (each with its own Course Outcome and syllabus content), and high-quality learning resources for the following subject.

Subject Title: "{{{subjectTitle}}}"
Keywords: {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Guidelines:
1. The description should be 2-3 sentences.
2. For each of the 5 units, provide:
   - A clear title.
   - Detailed syllabus content (list of topics).
   - A specific Course Outcome (CO) using Bloom's Taxonomy verbs (e.g., "Design...", "Evaluate...", "Implement...").
3. Learning resources should include standard textbooks or reputable online platforms.

Ensure the output is strictly in the requested JSON format.`,
});

const generateSyllabusContentFlow = ai.defineFlow(
  {
    name: 'generateSyllabusContentFlow',
    inputSchema: GenerateSyllabusContentInputSchema,
    outputSchema: GenerateSyllabusContentOutputSchema,
  },
  async (input) => {
    try {
      const response = await prompt(input);
      if (!response.output) {
        throw new Error(`AI failed to generate syllabus structure. Finish reason: ${response.finishReason || 'Unknown'}`);
      }
      return response.output;
    } catch (error: any) {
      console.error('Genkit Flow Error:', error);
      throw error;
    }
  }
);
