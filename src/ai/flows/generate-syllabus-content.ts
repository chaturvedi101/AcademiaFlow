'use server';
/**
 * @fileOverview Flow to generate full syllabus content using Gemini with Search Grounding.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const SyllabusInputSchema = z.object({
  title: z.string().describe('The official title of the academic course'),
  category: z.string().optional().describe('The credit category (e.g. DSC, DSE, VAC)'),
  credits: z.number().optional().describe('Total credits for the course'),
});

const SyllabusOutputSchema = z.object({
  units: z.array(z.object({
    title: z.string().describe('Unit title'),
    content: z.string().describe('Detailed unit content/topics'),
    hours: z.number().describe('Suggested teaching hours for this unit'),
    courseOutcome: z.string().describe('The primary learning outcome for this unit'),
  })).length(5),
  suggestedTextBooks: z.array(z.string()).describe('Standard textbooks with authors and editions'),
  suggestedReferences: z.array(z.string()).describe('Supplementary reference materials'),
});

export type GenerateSyllabusInput = z.infer<typeof SyllabusInputSchema>;
export type GenerateSyllabusOutput = z.infer<typeof SyllabusOutputSchema>;

const syllabusPrompt = ai.definePrompt({
  name: 'generateSyllabusPrompt',
  model: googleAI.model('gemini-flash-latest'),
  input: { schema: SyllabusInputSchema },
  output: { schema: SyllabusOutputSchema },
  config: {
    googleSearchRetrieval: true,
  },
  prompt: `You are an expert academic curriculum designer for a technical university. 
  Research and generate a professional, modern syllabus for the course: "{{{title}}}".
  
  Context:
  - Category: {{{category}}}
  - Target Credits: {{{credits}}}
  
  Requirements:
  1. Generate exactly 5 units that cover the core fundamentals to advanced topics.
  2. For each unit, provide a specific title and a detailed block of topics (comma-separated).
  3. Suggest teaching hours for each unit (usually 8-10 hours per unit for a 3-4 credit course).
  4. Define a clear Course Outcome (CO) for each unit following Bloom's Taxonomy.
  5. Suggest 3-5 authoritative Text Books and 3-5 Reference Books.
  
  Use Google Search to ensure the content reflects current industry standards and AICTE guidelines for 2024-25.`,
});

export async function generateSyllabusContent(input: GenerateSyllabusInput): Promise<GenerateSyllabusOutput> {
  try {
    const { output } = await syllabusPrompt(input);
    if (!output) throw new Error('AI failed to generate syllabus content. Please try again.');
    return output;
  } catch (error: any) {
    console.error('Syllabus AI Flow Error:', error);
    throw error;
  }
}
