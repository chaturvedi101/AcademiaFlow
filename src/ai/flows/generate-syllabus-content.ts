'use server';
/**
 * @fileOverview Flow to generate full syllabus content - DISABLED BY INSTITUTIONAL POLICY.
 */

import { z } from 'genkit';

const SyllabusInputSchema = z.object({
  title: z.string(),
});

const SyllabusOutputSchema = z.object({
  units: z.array(z.any()),
  suggestedTextBooks: z.array(z.string()),
  suggestedReferences: z.array(z.string()),
});

export type GenerateSyllabusInput = z.infer<typeof SyllabusInputSchema>;
export type GenerateSyllabusOutput = z.infer<typeof SyllabusOutputSchema>;

export async function generateSyllabusContent(input: GenerateSyllabusInput): Promise<GenerateSyllabusOutput> {
  throw new Error('AI Syllabus Generation has been disabled by institutional leadership. Please enter content manually.');
}
