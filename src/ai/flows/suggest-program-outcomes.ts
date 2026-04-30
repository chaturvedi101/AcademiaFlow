'use server';
/**
 * @fileOverview An AI assistant that suggests relevant program outcomes based on a course outcome.
 *
 * - suggestProgramOutcomes - A function that handles the program outcome suggestion process.
 * - SuggestProgramOutcomesInput - The input type for the suggestProgramOutcomes function.
 * - SuggestProgramOutcomesOutput - The return type for the suggestProgramOutcomes function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestProgramOutcomesInputSchema = z.object({
  courseOutcome: z
    .string()
    .describe("The text of the course outcome for which to suggest program outcomes."),
});
export type SuggestProgramOutcomesInput = z.infer<typeof SuggestProgramOutcomesInputSchema>;

const SuggestProgramOutcomesOutputSchema = z.object({
  suggestedProgramOutcomes: z
    .array(z.string())
    .describe("An array of relevant program outcomes suggested based on the course outcome."),
});
export type SuggestProgramOutcomesOutput = z.infer<typeof SuggestProgramOutcomesOutputSchema>;

export async function suggestProgramOutcomes(
  input: SuggestProgramOutcomesInput
): Promise<SuggestProgramOutcomesOutput> {
  return suggestProgramOutcomesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestProgramOutcomesPrompt',
  input: {schema: SuggestProgramOutcomesInputSchema},
  output: {schema: SuggestProgramOutcomesOutputSchema},
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  },
  prompt: `You are an expert academic assistant specializing in Outcome-Based Education (OBE) and academic compliance (NAAC/AICTE).
Your task is to suggest relevant Program Outcomes (POs) based on a given Course Outcome (CO).

When suggesting Program Outcomes, consider the scope, depth, and learning objectives implied by the Course Outcome.
Provide a list of program outcomes that are most directly aligned with or supported by the given Course Outcome.

Course Outcome: {{{courseOutcome}}}

Suggest relevant Program Outcomes as a JSON array of strings.`,
});

const suggestProgramOutcomesFlow = ai.defineFlow(
  {
    name: 'suggestProgramOutcomesFlow',
    inputSchema: SuggestProgramOutcomesInputSchema,
    outputSchema: SuggestProgramOutcomesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('AI failed to suggest program outcomes.');
    }
    return output;
  }
);
