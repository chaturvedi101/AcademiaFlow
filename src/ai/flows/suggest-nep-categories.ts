
'use server';
/**
 * @fileOverview Flow to suggest NEP category for a course.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CategoryInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
});

const CategoryOutputSchema = z.object({
  suggestedCategory: z.enum(['DSC', 'DSE', 'OFE', 'CPF', 'VAC', 'AEC', 'SEC', 'MDC']),
  reasoning: z.string(),
});

const categoryPrompt = ai.definePrompt({
  name: 'suggestNEPCategoryPrompt',
  input: { schema: CategoryInputSchema },
  output: { schema: CategoryOutputSchema },
  config: {
    model: 'googleai/gemini-3-flash-preview',
  },
  prompt: `Analyze the course title and description to suggest the most appropriate NEP 2020 credit category.
  
  Categories:
  - DSC: Discipline Specific Core
  - DSE: Discipline Specific Elective
  - OFE: Open Elective
  - VAC: Value Added Course
  - SEC: Skill Enhancement Course
  - AEC: Ability Enhancement Course
  
  Course: {{{title}}}
  Description: {{{description}}}`,
});

export async function suggestNEPCategory(input: z.infer<typeof CategoryInputSchema>): Promise<z.infer<typeof CategoryOutputSchema>> {
  const { output } = await categoryPrompt(input);
  if (!output) throw new Error('AI failed to suggest NEP category');
  return output;
}
