'use server';
/**
 * @fileOverview Flow to generate full syllabus content including units and course outcomes.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SyllabusInputSchema = z.object({
  title: z.string().describe('The title of the subject'),
  subjectCode: z.string().optional().describe('The code of the subject'),
  unitCount: z.number().min(1).max(10).default(5).describe('Number of units to generate'),
  level: z.string().optional().describe('Academic level (UG/PG)'),
});

const SyllabusOutputSchema = z.object({
  units: z.array(z.object({
    title: z.string().describe('Unit title'),
    content: z.string().describe('Detailed syllabus content for this unit'),
    courseOutcome: z.string().describe('The specific learning outcome for this unit (CO)'),
  })),
  suggestedResources: z.array(z.string()).describe('List of suggested textbooks or online resources'),
  suggestedCategory: z.string().describe('Suggested NEP category (e.g. DSC, DSE)'),
});

export type GenerateSyllabusInput = z.infer<typeof SyllabusInputSchema>;
export type GenerateSyllabusOutput = z.infer<typeof SyllabusOutputSchema>;

const syllabusPrompt = ai.definePrompt({
  name: 'generateSyllabusPrompt',
  // Explicitly defining model for Genkit 1.x stability
  model: 'googleai/gemini-2.5-flash',
  input: { schema: SyllabusInputSchema },
  output: { schema: SyllabusOutputSchema },
  config: {
    maxOutputTokens: 2048,
    temperature: 0.7,
  },
  prompt: `You are an expert academic curriculum designer for a technical university following NEP 2020 and AICTE guidelines.
  
  Generate a detailed syllabus for the course: "{{{title}}}" (Code: {{{subjectCode}}}).
  The syllabus should have exactly {{{unitCount}}} units.
  Level: {{{level}}}
  
  For each unit, provide:
  1. A professional title.
  2. Detailed content topics separated by semicolons.
  3. A clear Course Outcome (CO) statement using Bloom's Taxonomy verbs (e.g., "Analyze", "Design", "Evaluate").
  
  Also suggest appropriate resources and the most fitting NEP credit category.`,
});

export async function generateSyllabusContent(input: GenerateSyllabusInput): Promise<GenerateSyllabusOutput> {
  try {
    const { output } = await syllabusPrompt(input);
    if (!output) throw new Error('AI failed to generate syllabus content');
    return output;
  } catch (error: any) {
    console.error('Genkit Syllabus Flow Error:', error);
    throw error;
  }
}