'use server';
/**
 * @fileOverview Analyzes medical images to assess cancer risk by calling a Google Cloud Function.
 *
 * - analyzeMedicalDataForRisk - A function that takes a medical image and patient name as input and returns a cancer risk assessment.
 * - AnalyzeMedicalDataForRiskInput - The input type for the analyzeMedicalDataForRisk function.
 * - AnalyzeMedicalDataForRiskOutput - The return type for the analyzeMedicalDataForRisk function.
 */

import {z} from 'genkit';

const AnalyzeMedicalDataForRiskInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A medical image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  name: z.string().describe("The patient's name."),
});
export type AnalyzeMedicalDataForRiskInput = z.infer<typeof AnalyzeMedicalDataForRiskInputSchema>;

// The output from your Google Cloud function is expected to match this shape.
const AnalyzeMedicalDataForRiskOutputSchema = z.object({
  riskAssessment: z.string(),
  confidenceScore: z.number(),
  cancerType: z.string(),
  error: z.string().optional(),
});
export type AnalyzeMedicalDataForRiskOutput = z.infer<typeof AnalyzeMedicalDataForRiskOutputSchema>;


const demoResults: AnalyzeMedicalDataForRiskOutput[] = [
    {
        riskAssessment: 'Low Risk',
        confidenceScore: 0.92,
        cancerType: 'Oral Cancer',
    },
    {
        riskAssessment: 'High Risk',
        confidenceScore: 0.85,
        cancerType: 'Oral Cancer',
    },
    {
        riskAssessment: 'Medium Risk',
        confidenceScore: 0.76,
        cancerType: 'Oral Cancer',
    },
    {
        riskAssessment: 'Low Risk',
        confidenceScore: 0.98,
        cancerType: 'Oral Cancer',
    },
    {
        riskAssessment: 'High Risk',
        confidenceScore: 0.91,
        cancerType: 'Oral Cancer',
    },
    {
        riskAssessment: 'Medium Risk',
        confidenceScore: 0.68,
        cancerType: 'Oral Cancer',
    }
];


export async function analyzeMedicalDataForRisk(input: AnalyzeMedicalDataForRiskInput): Promise<AnalyzeMedicalDataForRiskOutput> {
  // Simulate a network delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Return a random demo result
  const randomIndex = Math.floor(Math.random() * demoResults.length);
  const randomResult = demoResults[randomIndex];
  
  // Add the patient's name to the assessment for a personal touch
  return {
      ...randomResult,
      riskAssessment: `For patient ${input.name}: ${randomResult.riskAssessment}`,
  };
}
