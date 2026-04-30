'use server';
/**
 * @fileOverview An AI assistant flow for generating initial drafts of syllabus content.
 *
 * - generateSyllabusContent - A function that generates course outcomes, learning resources, and a subject description.
 * - GenerateSyllabusContentInput - The input type for the generateSyllabusContent function.
 * - GenerateSyllabusContentOutput - The return type for the generateSyllabusContent function.
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
      'A list of 3-5 recommended learning resources (e.g., textbooks, online courses, research papers).'
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
  prompt: `You are an expert academic content creator for technical university syllabi. Your task is to generate a subject description, course outcomes, and learning resources based on a given subject title and keywords.

Generate the content in a structured JSON object with the following fields:
- 'subjectDescription': A brief, concise description of the subject.
- 'courseOutcomes': A list of 3-5 specific, measurable, achievable, relevant, and time-bound learning outcomes for the subject.
- 'learningResources': A list of 3-5 recommended learning resources, such as textbooks, online courses, research papers, or software tools.

Subject Title: "{{{subjectTitle}}}"
Keywords: {{{keywords}}}

Ensure the content is appropriate for a technical university curriculum. Do not include any introductory or concluding remarks outside the JSON.`,
});

const generateSyllabusContentFlow = ai.defineFlow(
  {
    name: 'generateSyllabusContentFlow',
    inputSchema: GenerateSyllabusContentInputSchema,
    outputSchema: GenerateSyllabusContentOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
