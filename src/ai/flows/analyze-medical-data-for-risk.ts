'use server';
/**
 * @fileOverview Analyzes medical images and clinical data to assess cancer risk.
 *
 * - analyzeMedicalDataForRisk - A function that takes medical image and clinical data as input and returns a cancer risk assessment.
 * - AnalyzeMedicalDataForRiskInput - The input type for the analyzeMedicalDataForRisk function.
 * - AnalyzeMedicalDataForRiskOutput - The return type for the analyzeMedicalDataForRisk function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeMedicalDataForRiskInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A medical image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  age: z.number().describe('The patient\'s age.'),
  gender: z.string().describe('The patient\'s gender.'),
  smokingStatus: z.string().describe('The patient\'s smoking status.'),
});
export type AnalyzeMedicalDataForRiskInput = z.infer<typeof AnalyzeMedicalDataForRiskInputSchema>;

const AnalyzeMedicalDataForRiskOutputSchema = z.object({
  riskAssessment: z.string().describe('The AI-driven risk assessment for cancer (e.g., High Risk, Low Risk).'),
  confidenceScore: z.number().describe('The confidence score of the risk assessment.'),
});
export type AnalyzeMedicalDataForRiskOutput = z.infer<typeof AnalyzeMedicalDataForRiskOutputSchema>;

export async function analyzeMedicalDataForRisk(input: AnalyzeMedicalDataForRiskInput): Promise<AnalyzeMedicalDataForRiskOutput> {
  return analyzeMedicalDataForRiskFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeMedicalDataForRiskPrompt',
  input: {schema: AnalyzeMedicalDataForRiskInputSchema},
  output: {schema: AnalyzeMedicalDataForRiskOutputSchema},
  prompt: `You are an AI expert in analyzing medical images and clinical data to assess cancer risk.

  Analyze the provided medical image and clinical data to provide a cancer risk assessment and a confidence score.

  Medical Image: {{media url=imageDataUri}}
  Age: {{{age}}}
  Gender: {{{gender}}}
  Smoking Status: {{{smokingStatus}}}

  Provide the risk assessment and confidence score based on your analysis.
  Make sure to return a detailed explanation for your determination.
  `,
});

const analyzeMedicalDataForRiskFlow = ai.defineFlow(
  {
    name: 'analyzeMedicalDataForRiskFlow',
    inputSchema: AnalyzeMedicalDataForRiskInputSchema,
    outputSchema: AnalyzeMedicalDataForRiskOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
