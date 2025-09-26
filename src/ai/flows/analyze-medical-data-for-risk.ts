'use server';
/**
 * @fileOverview Analyzes medical images to assess cancer risk by calling a Google Cloud Function.
 *
 * - analyzeMedicalDataForRisk - A function that takes a medical image and returns a cancer risk assessment.
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
});
export type AnalyzeMedicalDataForRiskInput = z.infer<typeof AnalyzeMedicalDataForRiskInputSchema>;

const AnalyzeMedicalDataForRiskOutputSchema = z.object({
  riskAssessment: z.string(),
  confidenceScore: z.number(),
  cancerType: z.string(),
  error: z.string().optional(),
});
export type AnalyzeMedicalDataForRiskOutput = z.infer<typeof AnalyzeMedicalDataForRiskOutputSchema>;


// The URL of your deployed Google Cloud Function.
const CLOUD_FUNCTION_URL = 'https://predict-cancer-risk-45392067984.asia-south1.run.app';

export async function analyzeMedicalDataForRisk(input: AnalyzeMedicalDataForRiskInput): Promise<AnalyzeMedicalDataForRiskOutput> {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageDataUri: input.imageDataUri,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloud Function error:', errorData);
      return {
        riskAssessment: '',
        confidenceScore: 0,
        cancerType: '',
        error: `Analysis failed: ${errorData.error || 'The model could not be reached.'}`,
      };
    }

    const result = await response.json();
    return result as AnalyzeMedicalDataForRiskOutput;
  } catch (error) {
    console.error('Error calling Cloud Function:', error);
    return {
      riskAssessment: '',
      confidenceScore: 0,
      cancerType: '',
      error: 'An unexpected error occurred while contacting the analysis service.',
    };
  }
}
