
'use server';
/**
 * @fileOverview Flow to generate full syllabus content including units, subunits, outcomes, and resource recommendations.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const SyllabusInputSchema = z.object({
  title: z.string().describe('The title of the subject'),
  subjectCode: z.string().optional().describe('The code of the subject'),
  unitCount: z.number().min(1).max(10).default(5).describe('Number of units to generate'),
  level: z.string().optional().describe('Academic level (UG/PG)'),
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
    })).describe('Breakdown of unit into logical sub-topics'),
  })),
  suggestedTextBooks: z.array(z.string()).describe('List of recommended textbooks (Author, Title, Publisher)'),
  suggestedReferences: z.array(z.string()).describe('List of suggested reference books or online resources'),
  suggestedNptelLinks: z.array(z.string()).describe('Suggested NPTEL or SWAYAM course links (if applicable)'),
  suggestedYoutubeLinks: z.array(z.string()).describe('Suggested educational YouTube video or playlist links'),
  suggestedCategory: z.string().describe('Suggested NEP category (e.g. DSC, DSE)'),
});

export type GenerateSyllabusInput = z.infer<typeof SyllabusInputSchema>;
export type GenerateSyllabusOutput = z.infer<typeof SyllabusOutputSchema>;

const syllabusPrompt = ai.definePrompt({
  name: 'generateSyllabusPrompt',
  model: googleAI.model('gemini-flash-latest'),
  input: { schema: SyllabusInputSchema },
  output: { schema: SyllabusOutputSchema },
  config: {
    maxOutputTokens: 3000,
    temperature: 0.7,
  },
  prompt: `You are an expert academic curriculum designer for a technical university following NEP 2020 and AICTE guidelines.
  
  Generate a detailed syllabus for the course: "{{{title}}}" (Code: {{{subjectCode}}}).
  The syllabus should have exactly {{{unitCount}}} units.
  Level: {{{level}}}
  
  For each unit, provide:
  1. A professional title.
  2. A total hour allocation (typically 8-10 hours per unit).
  3. A breakdown into specific sub-units, each with their own title and hour allocation. Ensure sub-unit hours sum to unit total.
  4. A clear Course Outcome (CO) statement.
  
  Also provide:
  1. Standard Text Books in citation format.
  2. Suggestions for NPTEL/SWAYAM and YouTube videos.
  3. The most fitting NEP category (DSC/DSE/SEC/AEC/VAC).`,
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
