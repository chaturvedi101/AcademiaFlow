'use server';
/**
 * @fileOverview AI flow for generating academic syllabus structures.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SyllabusUnitSchema = z.object({
  title: z.string().describe('Unit title'),
  content: z.string().describe('Unit topics and details'),
  courseOutcome: z.string().describe('Specific learning outcome for this unit'),
});

const GenerateSyllabusContentInputSchema = z.object({
  subjectTitle: z.string(),
  keywords: z.array(z.string()).optional(),
  unitCount: z.number().min(1).max(10).default(5).describe('Number of units to generate'),
});

const GenerateSyllabusContentOutputSchema = z.object({
  units: z.array(SyllabusUnitSchema).describe('The requested academic units'),
  suggestedResources: z.array(z.string()).describe('Recommended textbooks or URLs'),
});

export type GenerateSyllabusContentInput = z.infer<typeof GenerateSyllabusContentInputSchema>;
export type GenerateSyllabusContentOutput = z.infer<typeof GenerateSyllabusContentOutputSchema>;

const syllabusPrompt = ai.definePrompt({
  name: 'syllabusPrompt',
  input: { schema: GenerateSyllabusContentInputSchema },
  output: { schema: SyllabusUnitSchema.array() }, // Simplified output schema for the prompt to improve reliability
  config: {
    temperature: 0.7,
  },
  prompt: `You are an expert academic curriculum designer for a technical university.
  
Generate a comprehensive syllabus for the course: "{{{subjectTitle}}}".

Contextual Keywords: {{#each keywords}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Requirements:
1. Provide exactly {{{unitCount}}} units.
2. For each unit, write a professional title and a list of topics.
3. Each unit must have one high-level Course Outcome (CO) using Bloom's Taxonomy verbs.

Return only the list of units.`,
});

export async function generateSyllabusContent(input: GenerateSyllabusContentInput): Promise<GenerateSyllabusContentOutput> {
  try {
    const { output } = await syllabusPrompt(input);
    if (!output) {
      throw new Error('AI returned empty output.');
    }
    
    // We enhance the output with some static resources if the model only returns units
    return {
      units: output.map(u => ({ ...u, id: Math.random().toString(36).substr(2, 9) })),
      suggestedResources: [
        "Standard University Textbook for " + input.subjectTitle,
        "NPTEL Online Certification Course",
        "Reference Manual v1.0"
      ]
    };
  } catch (error: any) {
    console.error("AI Flow Error:", error);
    throw new Error(error.message || 'AI failed to generate syllabus content.');
  }
}
