'use server';
/**
 * @fileOverview Flow to suggest CO-PO mapping correlations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const MappingInputSchema = z.object({
  subjectTitle: z.string(),
  units: z.array(z.object({
    id: z.string(),
    courseOutcome: z.string(),
  })),
});

const MappingOutputSchema = z.object({
  mappings: z.record(z.string(), z.record(z.string(), z.enum(['1', '2', '3', '-']))),
});

export type SuggestMappingInput = z.infer<typeof MappingInputSchema>;
export type SuggestMappingOutput = z.infer<typeof MappingOutputSchema>;

const mappingPrompt = ai.definePrompt({
  name: 'suggestMappingPrompt',
  model: googleAI.model('gemini-1.5-flash'),
  input: { schema: MappingInputSchema },
  output: { schema: MappingOutputSchema },
  prompt: `As an academic auditor, suggest the correlation matrix between Course Outcomes (COs) and Program Outcomes (POs) for the course "{{{subjectTitle}}}".
  
  Standard POs (PO1-PO12) are:
  PO1: Engineering Knowledge, PO2: Problem Analysis, PO3: Design/Development, PO4: Investigations, PO5: Tool Usage, PO6: Society, PO7: Environment, PO8: Ethics, PO9: Teamwork, PO10: Communication, PO11: Project Management, PO12: Life-long Learning.
  
  Correlation Levels:
  1: Slight (Low)
  2: Moderate (Medium)
  3: Substantial (High)
  -: No correlation
  
  Course Outcomes to map:
  {{#each units}}
  - CO{{@index}}: {{{courseOutcome}}} (ID: {{{id}}})
  {{/each}}
  
  Return a mapping for each unit ID and each PO code (PO1 through PO12).`,
});

export async function suggestCOPOMapping(input: SuggestMappingInput): Promise<SuggestMappingOutput> {
  try {
    const { output } = await mappingPrompt(input);
    if (!output) throw new Error('AI failed to generate mapping suggestions');
    return output;
  } catch (error: any) {
    console.error('Genkit CO-PO Flow Error:', error);
    throw error;
  }
}
