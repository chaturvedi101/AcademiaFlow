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
      maxOutputTokens: 4096, // Increased token limit for detailed syllabi
      temperature: 0.4, // Slightly lower for more consistent formatting
      googleSearchRetrieval: {},
    },
    prompt: `You are an expert academic curriculum designer benchmarking against world-class technical universities.
    
    CRITICAL ANCHOR: The absolute and sole primary focus of this request is the subject: "{{{title}}}". 
    
    STEP 1: Research current academic syllabi for the specific course "{{{title}}}" at the {{level}} level across top-tier technical institutes (e.g., IITs, MIT, Stanford, and standard AICTE/UGC models).
    STEP 2: Analyze the specific depth required for a {{level}} student in Semester {{semester}}. 
    STEP 3: Ensure zero deviation into "{{branch}}" core topics unless "{{{title}}}" is inherently a branch-specific elective. For fundamental subjects (Maths, Physics, etc.), stay strictly within the domain of the subject title.
    
    STEP 4: Synthesize a syllabus with EXACTLY {{unitCount}} units for "{{{title}}}".
    - Target: {{totalHours}} teaching hours distributed logically across units.
    - Context: The students have studied {{#each previousCourses}}"{{this}}", {{/each}} and are concurrently studying {{#each peerCourses}}"{{this}}", {{/each}}. Avoid duplicating topics from these specific lists.
    
    MANDATORY OUTPUT FIELDS:
    - units: An array of exactly {{unitCount}} objects.
    - suggestedTextBooks: A list of latest editions of standard textbooks for {{{title}}}.
    - suggestedReferences: A list of standard reference books and research materials.
    
    Each unit must have a title, detailed content string, teaching hours, and a measurable course outcome (CO).`,
  });

  if (!response.output) throw new Error('AI failed to generate syllabus content. Check your API key and network connection.');
  return response.output;
}
