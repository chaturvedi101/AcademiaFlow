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
  model: 'googleai/gemini-1.5-flash',
  input: { schema: SuggestPOInputSchema },
  output: { schema: SuggestPOOutputSchema },
  prompt: `Analyze the following Course Outcome (CO) and map it to standard Engineering Program Outcomes (POs).

Standard POs: PO1 (Knowledge), PO2 (Analysis), PO3 (Design), PO4 (Investigation), PO5 (Tools), PO6 (Society), PO7 (Environment), PO8 (Ethics), PO9 (Team), PO10 (Comm), PO11 (PM), PO12 (Learning).

Course Outcome: "{{{courseOutcome}}}"

Return a list of PO identifiers (e.g., ["PO1", "PO2"]) and a brief justification.`,
});

export async function suggestProgramOutcomes(input: SuggestPOInput): Promise<SuggestPOOutput> {
  try {
    const { output } = await poPrompt(input);
    if (!output) throw new Error('AI failed to map outcomes.');
    return output;
  } catch (error: any) {
    if (error.message?.includes('400') || error.message?.toLowerCase().includes('expired')) {
      throw new Error('API_KEY_ERROR: Invalid API Key.');
    }
    throw error;
  }
}
