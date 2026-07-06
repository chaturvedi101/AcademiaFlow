'use server';
/**
 * @fileOverview Flow to generate full syllabus content using Gemini with Search Grounding.
 * Handles both Theory (Units) and Lab/Sessional (Experiments) methodologies.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const SyllabusInputSchema = z.object({
  title: z.string().describe('The official title of the academic course'),
  category: z.string().optional().describe('The credit category (e.g. DSC, DSE, VAC)'),
  credits: z.number().optional().describe('Total credits for the course'),
  type: z.enum(['Theory', 'Lab/Sessional']).optional().describe('The methodology of the course'),
});

const SyllabusOutputSchema = z.object({
  units: z.array(z.object({
    title: z.string().describe('Unit title or Experiment name (e.g. Experiment 1: Title)'),
    content: z.string().describe('Detailed content, topics, or experiment procedure/objective'),
    hours: z.number().describe('Suggested teaching hours for this specific unit or experiment'),
    courseOutcome: z.string().describe('The learning outcome for this specific item'),
  })),
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
  - Methodology: {{{type}}}
  
  Requirements for Theory:
  1. If methodology is "Theory", generate exactly 5 units.
  2. For each unit, provide a specific title and a detailed block of topics.
  3. Suggest teaching hours (usually 8-10 hours per unit).
  
  Requirements for Lab/Sessional:
  1. If methodology is "Lab/Sessional", generate at least 8 to 10 Experiments.
  2. Label each item as "Experiment X: [Title]" (e.g. Experiment 1: Synthesis of...).
  3. Content should describe the objective and list of equipment/software or procedure.
  4. Suggest teaching hours (usually 2-3 hours per experiment).
  
  General Requirements:
  1. Define clear Course Outcomes (CO) following Bloom's Taxonomy.
  2. Suggest 3-5 authoritative Text Books and 3-5 Reference Books.
  
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
