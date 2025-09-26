'use server';
/**
 * @fileOverview A flow for predicting cancer risk from a medical image using a custom-trained model on Vertex AI.
 *
 * - predictCancerRisk - A function that takes an image and returns a cancer risk assessment.
 * - PredictCancerRiskInput - The input type for the predictCancerRisk function.
 * - PredictCancerRiskOutput - The return type for the predictCancerRisk function.
 */

import {ai} from '@/ai/genkit';
import {vertexAI} from '@genkit-ai/vertexai';
import {z} from 'genkit';

// Define the input schema for our flow
const PredictCancerRiskInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A medical image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  cancerType: z.string().describe('The type of cancer to analyze for, e.g., "Oral Cancer".'),
});
export type PredictCancerRiskInput = z.infer<typeof PredictCancerRiskInputSchema>;

// Define the output schema for our flow
const PredictCancerRiskOutputSchema = z.object({
  riskAssessment: z.string(),
  confidenceScore: z.number(),
  cancerType: z.string(),
  error: z.string().optional(),
});
export type PredictCancerRiskOutput = z.infer<typeof PredictCancerRiskOutputSchema>;


// This is the main flow function that the frontend will call.
export async function predictCancerRisk(input: PredictCancerRiskInput): Promise<PredictCancerRiskOutput> {
  try {
    const { output } = await ai.generate({
        model: vertexAI.model('custom-oral-cancer-model'),
        prompt: {
            image: input.imageDataUri,
        },
    });

    if (!output || !Array.isArray(output) || output.length === 0) {
        throw new Error('Invalid model output from Vertex AI.');
    }
    
    // The output from a custom model prediction is often a structure.
    // We need to access the 'predictions' key which contains the array of probabilities.
    const rawPredictions = (output as any).predictions;
    
    if (!rawPredictions || !Array.isArray(rawPredictions) || rawPredictions.length === 0) {
      throw new Error('Invalid prediction format in model output.');
    }

    const predictions = rawPredictions[0] as number[];
    const confidenceScore = Math.max(...predictions);
    const predictedClassIndex = predictions.indexOf(confidenceScore);
    
    // Assumes class 1 is 'High Risk' and class 0 is 'Low Risk'
    const riskAssessment = predictedClassIndex === 1 ? 'High Risk' : 'Low Risk';

    return {
      riskAssessment,
      confidenceScore,
      cancerType: input.cancerType,
    };
  } catch (e: any) {
    console.error('Error in predictCancerRisk flow:', e);
    return {
      riskAssessment: '',
      confidenceScore: 0,
      cancerType: input.cancerType,
      error: 'Analysis failed: The AI model could not be reached or returned an error.',
    };
  }
}
