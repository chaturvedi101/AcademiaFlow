'use server';
/**
 * @fileOverview Flow to critically analyze an entire academic scheme and its syllabi.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const AnalyzeSchemeInputSchema = z.object({
  schemeName: z.string(),
  batchYear: z.string(),
  programRules: z.any().describe('The credit boundaries defined for this program'),
  syllabi: z.array(z.any()).describe('The complete list of subjects with their units and outcomes'),
});

const AnalyzeSchemePromptInputSchema = z.object({
  schemeName: z.string(),
  batchYear: z.string(),
  programRulesJson: z.string(),
  syllabiJson: z.string(),
});

const AnalyzeSchemeOutputSchema = z.object({
  overallScore: z.number().describe('A score from 1-100 based on compliance and quality'),
  executiveSummary: z.string().describe('A high-level summary of the scheme quality'),
  structuralAudit: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    complianceStatus: z.string().describe('Alignment with NEP 2020 rules'),
  }),
  pedagogicalQuality: z.array(z.object({
    subjectCode: z.string(),
    title: z.string(),
    findings: z.string(),
    recommendations: z.string(),
  })).describe('Critical analysis of individual subject content'),
  strategicRecommendations: z.array(z.string()).describe('High-level steps to improve the degree program'),
});

export type AnalyzeSchemeInput = z.infer<typeof AnalyzeSchemeInputSchema>;
export type AnalyzeSchemeOutput = z.infer<typeof AnalyzeSchemeOutputSchema>;

const analysisPrompt = ai.definePrompt({
  name: 'analyzeSchemePrompt',
  model: googleAI.model('gemini-pro-latest'),
  input: { schema: AnalyzeSchemePromptInputSchema },
  output: { schema: AnalyzeSchemeOutputSchema },
  config: {
    googleSearchRetrieval: true,
  },
  prompt: `You are a Senior Academic Auditor for a Technical University. 
  Your task is to critically analyze the following academic scheme for the batch {{{batchYear}}}: "{{{schemeName}}}".
  
  CONTEXT:
  - Program Rules: {{{programRulesJson}}}
  - Complete Curriculum Structure: {{{syllabiJson}}}
  
  CRITERIA FOR ANALYSIS:
  1. **Structural Integrity**: Check if the credits for DSC, DSE, VAC, AEC, and MDC meet the institutional rules. Is the progression from Year 1 to Year 4 logical?
  2. **Pedagogical Depth**: Review the subject syllabi. Are the units comprehensive? Are the Course Outcomes (COs) measurable and mapped to Bloom's Taxonomy?
  3. **Industry Relevance**: Use Google Search to verify if the topics in technical subjects are modern (2024-25 standards).
  4. **Redundancy**: Identify if any topics are overlapping across different subjects in the same scheme.
  
  Provide a professional, critical, and constructive report.`,
});

export async function analyzeScheme(input: AnalyzeSchemeInput): Promise<AnalyzeSchemeOutput> {
  try {
    const { output } = await analysisPrompt({
      schemeName: input.schemeName,
      batchYear: input.batchYear,
      programRulesJson: JSON.stringify(input.programRules, null, 2),
      syllabiJson: JSON.stringify(input.syllabi, null, 2),
    });
    
    if (!output) throw new Error('AI failed to generate analysis. Please ensure the scheme has enough subjects.');
    return output;
  } catch (error: any) {
    console.error('Scheme Analysis Flow Error:', error);
    throw error;
  }
}
