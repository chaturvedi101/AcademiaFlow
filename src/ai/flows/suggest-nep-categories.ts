
'use server';
/**
 * @fileOverview AI flow for suggesting NEP 2020 credit categories.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestCategoryInputSchema = z.object({
  subjectTitle: z.string(),
  subjectDescription: z.string().optional(),
});

const SuggestCategoryOutputSchema = z.object({
  suggestedCategory: z.enum(['DSC', 'DSE', 'OFE', 'VAC', 'AEC', 'SEC', 'MDC']),
  reasoning: z.string(),
});

export type SuggestCategoryInput = z.infer<typeof SuggestCategoryInputSchema>;
export type SuggestCategoryOutput = z.infer<typeof SuggestCategoryOutputSchema>;

const categoryPrompt = ai.definePrompt({
  name: 'categoryPrompt',
  input: { schema: SuggestCategoryInputSchema },
  output: { schema: SuggestCategoryOutputSchema },
  prompt: `Based on the course title and description, suggest the most appropriate NEP 2020 credit category.

Categories:
- DSC: Discipline Specific Core (Core technical subjects)
- DSE: Discipline Specific Elective (Specialization electives)
- OFE: Open/Free Elective (Interdisciplinary)
- VAC: Value Added Course
- AEC: Ability Enhancement
- SEC: Skill Enhancement
- MDC: Multidisciplinary

Subject Title: "{{{subjectTitle}}}"
Description: {{{subjectDescription}}}

Suggest the most logical category and provide a brief academic justification.`,
});

export async function suggestNEPCategory(input: SuggestCategoryInput): Promise<SuggestCategoryOutput> {
  const { output } = await categoryPrompt(input);
  if (!output) throw new Error('AI failed to suggest NEP category');
  return output;
}
