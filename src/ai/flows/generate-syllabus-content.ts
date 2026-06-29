'use server';
/**
 * @fileOverview Flow to generate full syllabus content with academic context and search grounding.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const SyllabusInputSchema = z.object({
  title: z.string().describe('The title of the subject'),
  subjectCode: z.string().optional().describe('The code of the subject'),
  unitCount: z.number().min(1).max(10).default(5).describe('Number of units to generate'),
  level: z.string().optional().describe('Academic level (UG/PG)'),
  branch: z.string().optional().describe('Engineering Branch'),
  semester: z.number().optional().describe('Current semester'),
  previousCourses: z.array(z.string()).optional().describe('Titles of courses from previous semesters'),
  peerCourses: z.array(z.string()).optional().describe('Titles of other courses in the same semester'),
  totalHours: z.number().optional().describe('Total teaching hours target'),
  modelId: z.string().optional().default('googleai/gemini-flash-latest').describe('The model to use for generation'),
});

const SyllabusOutputSchema = z.object({
  units: z.array(z.object({
    title: z.string().describe('Unit title'),
    content: z.string().describe('Broad summary of unit content'),
    hours: z.number().describe('Total teaching hours for this unit'),
    courseOutcome: z.string().describe('The specific learning outcome for this unit (CO)'),
  })),
  suggestedTextBooks: z.array(z.string()).describe('List of recommended textbooks'),
  suggestedReferences: z.array(z.string()).describe('List of suggested reference books'),
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
      // Enable Search Grounding to find similar courses on the net
      googleSearchRetrieval: true,
    },
    prompt: `You are an expert academic curriculum designer for a technical university.
    
    STEP 1: Research current academic standards for "{{title}}" at the {{level}} level.
    STEP 2: Analyze the context: 
    - Branch: {{branch}}
    - Semester: {{semester}}
    - Student Background: They have already studied {{#each previousCourses}}"{{this}}", {{/each}}.
    - Current Load: This subject is being taught alongside {{#each peerCourses}}"{{this}}", {{/each}}.
    
    STEP 3: Generate a detailed syllabus with EXACTLY {{unitCount}} units.
    - Total Hours allocated for the full course: {{totalHours}} hours.
    - Ensure zero overlap with previous courses.
    - Focus on industry-relevant topics for {{branch}}.
    
    Provide Unit Titles, Content summaries, Teaching hours per unit, and clear Course Outcomes (COs).
    Also suggest the latest Standard Text Books and References.`,
  });

  if (!response.output) throw new Error('AI failed to generate syllabus content');
  return response.output;
}
