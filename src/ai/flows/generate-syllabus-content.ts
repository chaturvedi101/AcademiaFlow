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
      maxOutputTokens: 4096,
      temperature: 0.2, // Lowered for higher precision
      googleSearchRetrieval: {},
    },
    prompt: `You are a world-class Academic Curriculum Architect specializing in technical education.
    
    PRIMARY DIRECTIVE: Generate a syllabus for the subject: "{{{title}}}".
    
    CRITICAL ANCHORING:
    - The content MUST be strictly related to "{{{title}}}". 
    - The Branch is "{{branch}}". Use this ONLY to decide the depth of examples. 
    - DO NOT include topics from the Branch core if they are unrelated to the Subject Title.
    - Example: If the Subject is "Engineering Mechanics" and the Branch is "Computer Science", the syllabus MUST cover Statics and Dynamics, NOT Algorithms.
    
    STEP 1: USE GOOGLE SEARCH to find the standard latest (2024-2025) syllabus for "{{{title}}}" at the {{level}} level from premier institutes like IITs, NITs, MIT, and standard AICTE model curricula.
    STEP 2: Identify exact topics required for a Semester {{semester}} student.
    STEP 3: NEGATIVE CONSTRAINTS (DO NOT REPEAT):
      - Avoid duplicating content from Previous Courses: {{#each previousCourses}}"{{this}}", {{/each}}
      - Avoid overlapping with Concurrent Peer Courses: {{#each peerCourses}}"{{this}}", {{/each}}
    
    OUTPUT REQUIREMENTS:
    - Exactly {{unitCount}} units.
    - Total targeted hours: {{totalHours}} (distribute logically).
    - Detailed units with specific technical topics.
    - Standard industry-leading textbooks and reference books.
    
    MANDATORY JSON FIELDS: units, suggestedTextBooks, suggestedReferences.`,
  });

  if (!response.output) throw new Error('AI failed to generate syllabus content. The model returned an empty response. Try using Gemini Pro for complex reasoning.');
  return response.output;
}
