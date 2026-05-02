
'use server';
/**
 * @fileOverview AI flow for mapping Course Outcomes to standard Program Outcomes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SuggestPOInputSchema = z.object({
  courseOutcome: z.string().describe('The course outcome text to analyze'),
});

const SuggestPOOutputSchema = z.object({
  suggestedPOs: z.array(z.string()).describe('List of PO codes (PO1-PO12)'),
  justification: z.string().describe('Brief reason for the mapping'),
});

export type SuggestPOInput = z.infer<typeof SuggestPOInputSchema>;
export type SuggestPOOutput = z.infer<typeof SuggestPOOutputSchema>;

const poPrompt = ai.definePrompt({
  name: 'poPrompt',
  input: { schema: SuggestPOInputSchema },
  output: { schema: SuggestPOOutputSchema },
  prompt: `Analyze the following Course Outcome (CO) and map it to the 12 standard Engineering Program Outcomes (POs).

Standard POs:
PO1: Engineering Knowledge
PO2: Problem Analysis
PO3: Design/Development of Solutions
PO4: Conduct Investigations
PO5: Modern Tool Usage
PO6: The Engineer and Society
PO7: Environment and Sustainability
PO8: Ethics
PO9: Individual and Team Work
PO10: Communication
PO11: Project Management and Finance
PO12: Life-long Learning

Course Outcome: "{{{courseOutcome}}}"

Return a list of PO identifiers (e.g., ["PO1", "PO2"]) that strongly correlate with this outcome and a brief justification.`,
});

export async function suggestProgramOutcomes(input: SuggestPOInput): Promise<SuggestPOOutput> {
  const { output } = await poPrompt(input);
  if (!output) throw new Error('AI failed to map program outcomes');
  return output;
}
