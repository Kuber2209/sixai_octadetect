'use server';
/**
 * @fileOverview A flow for predicting cancer risk from a medical image using a custom-trained model on Vertex AI.
 *
 * - predictCancerRisk - A function that takes an image and returns a cancer risk assessment.
 * - PredictCancerRiskInput - The input type for the predictCancerRisk function.
 * - PredictCancerRiskOutput - The return type for the predictCancerRisk function.
 */

import { z } from 'genkit';
import {
  PredictionServiceClient,
  helpers,
} from '@google-cloud/aiplatform';

// Define the input schema for our flow
const PredictCancerRiskInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A medical image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  cancerType: z
    .string()
    .describe('The type of cancer to analyze for, e.g., "Oral Cancer".'),
});
export type PredictCancerRiskInput = z.infer<typeof PredictCancerRiskInputSchema>;

// Define the output schema for our flow
const PredictCancerRiskOutputSchema = z.object({
  riskAssessment: z.string(),
  confidenceScore: z.number(),
  cancerType: z.string(),
  error: z.string().optional(),
});
export type PredictCancerRiskOutput = z.infer<
  typeof PredictCancerRiskOutputSchema
>;

// This is the main flow function that the frontend will call.
export async function predictCancerRisk(
  input: PredictCancerRiskInput
): Promise<PredictCancerRiskOutput> {
  const { imageDataUri, cancerType } = input;
  
  // Configuration for the Vertex AI endpoint
  const project = process.env.GCLOUD_PROJECT || 'oncodetect-ai';
  const location = 'us-central1';
  const endpointId = '5381831701358313472'; // Your specific endpoint ID for the model

  const clientOptions = {
    apiEndpoint: `${location}-aiplatform.googleapis.com`,
  };

  const predictionServiceClient = new PredictionServiceClient(clientOptions);
  const endpoint = `projects/${project}/locations/${location}/endpoints/${endpointId}`;
  
  const imageBase64 = imageDataUri.split(';base64,').pop();

  const instance = helpers.toValue({
    content: imageBase64,
  });
  
  if (!instance) {
     return {
      riskAssessment: '',
      confidenceScore: 0,
      cancerType: cancerType,
      error: 'Failed to create instance for Vertex AI model.',
    };
  }
  
  const instances = [instance];
  const request = {
    endpoint,
    instances,
  };

  try {
    const [response] = await predictionServiceClient.predict(request);
    
    if (!response.predictions || response.predictions.length === 0) {
      throw new Error('Invalid response from Vertex AI: No predictions found.');
    }

    const predictionResult = helpers.fromValue(response.predictions[0]);
    
    if (!predictionResult || !('confidences' in predictionResult) || !('displayNames' in predictionResult)) {
        console.error('Invalid prediction result structure:', predictionResult);
        throw new Error('Invalid prediction result structure from Vertex AI.');
    }
    
    // The structure can be { confidences: [0.1, 0.9], displayNames: ["Low", "High"] }
    // We find the index of the max confidence and map it to the risk assessment
    const confidences = predictionResult.confidences as number[];
    const displayNames = predictionResult.displayNames as string[];

    const confidenceScore = Math.max(...confidences);
    const predictedClassIndex = confidences.indexOf(confidenceScore);
    const riskAssessment = displayNames[predictedClassIndex];

    return {
      riskAssessment,
      confidenceScore,
      cancerType: cancerType,
    };
  } catch (e: any) {
    console.error('Error in predictCancerRisk flow (Vertex AI SDK):', e);
    // Return a more user-friendly error
    return {
      riskAssessment: '',
      confidenceScore: 0,
      cancerType: cancerType,
      error: `Analysis failed. The AI model could not be reached or returned an error. This is likely a permissions issue. Please ensure the function's service account has the "Vertex AI User" role.`,
    };
  }
}
