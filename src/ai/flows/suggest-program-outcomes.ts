'use server';
/**
 * @fileOverview Suggests relevant program outcomes based on a course outcome.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestProgramOutcomesInputSchema = z.object({
  courseOutcome: z.string().describe("The course outcome text."),
});
export type SuggestProgramOutcomesInput = z.infer<typeof SuggestProgramOutcomesInputSchema>;

const SuggestProgramOutcomesOutputSchema = z.object({
  suggestedProgramOutcomes: z.array(z.string()).describe("Array of suggested PO codes (e.g., PO1, PO2)."),
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
    safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }],
  },
  prompt: `Based on the following Course Outcome, suggest which standard Engineering Program Outcomes (PO1 to PO12) it maps to. Provide the PO identifiers as strings.

Course Outcome: {{{courseOutcome}}}`,
});

const suggestProgramOutcomesFlow = ai.defineFlow(
  {
    name: 'suggestProgramOutcomesFlow',
    inputSchema: SuggestProgramOutcomesInputSchema,
    outputSchema: SuggestProgramOutcomesOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) throw new Error('AI failed to suggest program outcomes.');
    return output;
  }
);
