'use server';
/**
 * @fileOverview Flow to generate full syllabus content with model selection support.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const SyllabusInputSchema = z.object({
  title: z.string().describe('The title of the subject'),
  subjectCode: z.string().optional().describe('The code of the subject'),
  unitCount: z.number().min(1).max(10).default(5).describe('Number of units to generate'),
  level: z.string().optional().describe('Academic level (UG/PG)'),
  modelId: z.string().optional().default('googleai/gemini-flash-latest').describe('The model to use for generation'),
});

const SyllabusOutputSchema = z.object({
  units: z.array(z.object({
    title: z.string().describe('Unit title'),
    content: z.string().describe('Broad summary of unit content'),
    hours: z.number().describe('Total teaching hours for this unit'),
    courseOutcome: z.string().describe('The specific learning outcome for this unit (CO)'),
    subUnits: z.array(z.object({
      title: z.string().describe('Sub-topic title'),
      content: z.string().describe('Detailed topics for this sub-unit'),
      hours: z.number().describe('Hours for this sub-topic'),
    })).optional(),
  })),
  suggestedTextBooks: z.array(z.string()).describe('List of recommended textbooks'),
  suggestedReferences: z.array(z.string()).describe('List of suggested reference books'),
  suggestedNptelLinks: z.array(z.string()).optional(),
  suggestedYoutubeLinks: z.array(z.string()).optional(),
  suggestedCategory: z.string().optional(),
});

export type GenerateSyllabusInput = z.infer<typeof SyllabusInputSchema>;
export type GenerateSyllabusOutput = z.infer<typeof SyllabusOutputSchema>;

export async function generateSyllabusContent(input: GenerateSyllabusInput): Promise<GenerateSyllabusOutput> {
  const model = googleAI.model(input.modelId === 'googleai/gemini-pro-latest' ? 'gemini-pro-latest' : 'gemini-flash-latest');
  
  const response = await ai.generate({
    model,
    input: input,
    output: { schema: SyllabusOutputSchema },
    config: {
      maxOutputTokens: 3000,
      temperature: 0.7,
    },
    prompt: `You are an expert academic curriculum designer for a technical university following NEP 2020 and AICTE guidelines.
    
    Generate a detailed syllabus for the course: "{{title}}" (Code: {{subjectCode}}).
    The syllabus should have exactly {{unitCount}} units.
    Level: {{level}}
    
    For each unit, provide a professional title, teaching hours (8-10 per unit), and a clear Course Outcome (CO) statement.
    Also provide Standard Text Books and References.`,
  });

  if (!response.output) throw new Error('AI failed to generate syllabus content');
  return response.output;
}
