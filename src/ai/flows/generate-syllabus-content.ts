'use server';
/**
 * @fileOverview An AI assistant flow for generating initial drafts of syllabus content.
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

const GenerateSyllabusContentOutputSchema = z.object({
  subjectDescription: z
    .string()
    .describe('A brief, concise description of the subject.'),
  courseOutcomes: z
    .array(z.string())
    .describe('A list of 3-5 learning outcomes for the subject.'),
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
    ],
  },
  prompt: `You are an expert academic content creator. Generate a subject description, course outcomes, and learning resources for a technical university syllabus.

Subject Title: "{{{subjectTitle}}}"
Keywords: {{{keywords}}}

Ensure outcomes are specific and measurable.`,
});

const generateSyllabusContentFlow = ai.defineFlow(
  {
    name: 'generateSyllabusContentFlow',
    inputSchema: GenerateSyllabusContentInputSchema,
    outputSchema: GenerateSyllabusContentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) throw new Error('AI failed to generate syllabus structure.');
    return output;
  }
);
