'use server';
/**
 * @fileOverview A Genkit flow for suggesting relevant NEP 2020 categories based on subject title and description.
 *
 * - suggestNEPCategories - A function that suggests NEP 2020 categories.
 * - SuggestNEPCategoriesInput - The input type for the suggestNEPCategories function.
 * - SuggestNEPCategoriesOutput - The return type for the suggestNEPCategories function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestNEPCategoriesInputSchema = z.object({
  subjectTitle: z.string().describe('The title of the subject.'),
  subjectDescription: z.string().describe('A detailed description of the subject.'),
});
export type SuggestNEPCategoriesInput = z.infer<typeof SuggestNEPCategoriesInputSchema>;

const SuggestNEPCategoriesOutputSchema = z.object({
  suggestedCategories: z.array(z.string()).describe('An array of relevant NEP 2020 categories.'),
});
export type SuggestNEPCategoriesOutput = z.infer<typeof SuggestNEPCategoriesOutputSchema>;

export async function suggestNEPCategories(
  input: SuggestNEPCategoriesInput
): Promise<SuggestNEPCategoriesOutput> {
  return suggestNEPCategoriesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestNEPCategoriesPrompt',
  input: {schema: SuggestNEPCategoriesInputSchema},
  output: {schema: SuggestNEPCategoriesOutputSchema},
  prompt: `You are an expert in NEP 2020 guidelines for technical universities. Based on the provided subject title and description, suggest relevant NEP 2020 categories.

The categories can include, but are not limited to: 'Experiential Learning', 'Indian Knowledge Systems', 'Vocational', 'Ability Enhancement', 'Skill Enhancement', 'Value Added Course', 'Multidisciplinary', 'Discipline Specific Core', 'Discipline Specific Elective', 'Open/Free Elective', 'Common Pool and Foundational Components'.

Provide the output as a JSON array of strings for the 'suggestedCategories' field.

Subject Title: {{{subjectTitle}}}
Subject Description: {{{subjectDescription}}}`,
});

const suggestNEPCategoriesFlow = ai.defineFlow(
  {
    name: 'suggestNEPCategoriesFlow',
    inputSchema: SuggestNEPCategoriesInputSchema,
    outputSchema: SuggestNEPCategoriesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
