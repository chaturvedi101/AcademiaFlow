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
    safetySettings: [
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
    ],
  },
  prompt: `Based on the following Course Outcome, suggest which standard Engineering Program Outcomes (PO1 to PO12) it maps to.
  
Engineering Program Outcomes (POs):
PO1: Engineering Knowledge
PO2: Problem Analysis
PO3: Design/Development of Solutions
PO4: Conduct Investigations of Complex Problems
PO5: Modern Tool Usage
PO6: The Engineer and Society
PO7: Environment and Sustainability
PO8: Ethics
PO9: Individual and Team Work
PO10: Communication
PO11: Project Management and Finance
PO12: Life-long Learning

Course Outcome: "{{{courseOutcome}}}"

Provide only the identifiers like "PO1", "PO2" in the output array.`,
});

const suggestProgramOutcomesFlow = ai.defineFlow(
  {
    name: 'suggestProgramOutcomesFlow',
    inputSchema: SuggestProgramOutcomesInputSchema,
    outputSchema: SuggestProgramOutcomesOutputSchema,
  },
  async input => {
    const response = await prompt(input);
    if (!response.output) {
      throw new Error(`AI failed to suggest program outcomes. Finish reason: ${response.finishReason || 'Unknown'}`);
    }
    return response.output;
  }
);
