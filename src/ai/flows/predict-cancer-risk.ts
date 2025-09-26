'use server';
/**
 * @fileOverview A flow for predicting cancer risk from a medical image using a custom-trained model on Vertex AI.
 *
 * - predictCancerRisk - A function that takes an image and returns a cancer risk assessment.
 * - PredictCancerRiskInput - The input type for the predictCancerRisk function.
 * - PredictCancerRiskOutput - The return type for the predictCancerRisk function.
 */

import {ai} from '@/ai/genkit';
import {defineModel, modelRef} from 'genkit';
import {z} from 'genkit';

const BUCKET_NAME = 'oncodetect-ai-models';

// Define a reference to the custom-trained model hosted on Google Cloud Storage.
// Genkit will manage deploying this to a Vertex AI Endpoint.
const cancerModel = defineModel(
  {
    name: 'vertexai/custom-oral-cancer-model',
    label: 'Oral Cancer Detection Model',
    config: {
      type: 'tensorflow',
      modelUri: `gs://${BUCKET_NAME}/oral_cancer_model.h5`,
    },
  },
  async (input) => {
    // This is the model's prediction logic.
    // It will be executed on Google's infrastructure.
    const model = modelRef({name: 'vertexai/custom-oral-cancer-model'});
    const {output} = await ai.generate({
      model,
      prompt: {
        // The input schema for the TF model is just the image.
        // The actual name of the input tensor in the model is 'image'.
        image: input.image,
      },
    });

    return {
      // The model output is an array of probabilities.
      // We need to find the highest probability and its index.
      predictions: output as number[],
    };
  }
);

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
        model: cancerModel,
        prompt: {
            image: input.imageDataUri,
        },
    });

    if (!output || !Array.isArray(output) || output.length === 0) {
        throw new Error('Invalid model output from Vertex AI.');
    }
    
    const predictions = output as number[];
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
