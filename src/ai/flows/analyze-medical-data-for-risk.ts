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
  error: z.string().optional(),
});
export type AnalyzeMedicalDataForRiskOutput = z.infer<typeof AnalyzeMedicalDataForRiskOutputSchema>;


export async function analyzeMedicalDataForRisk(input: AnalyzeMedicalDataForRiskInput): Promise<AnalyzeMedicalDataForRiskOutput> {
  const GOOGLE_CLOUD_FUNCTION_URL = 'https://predict-cancer-risk-45392067984.asia-south1.run.app';

  // The client-side code already converts the image to a Base64 data URI.
  // We can pass it directly in the payload.
  const payload = {
    name: input.name,
    image_base64: input.imageDataUri,
  };

  try {
    // 2. Send the data to your Google Cloud Function
    const response = await fetch(GOOGLE_CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload), // Send the data as a JSON string
    });

    // 3. Check if the request was successful
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API call failed with status: ${response.status}`, errorText);
      throw new Error(`API call failed with status: ${response.status}`);
    }

    // 4. Get the prediction result and return it to the frontend
    const result = await response.json();
    
    // Validate the result against our expected schema
    const parsedResult = AnalyzeMedicalDataForRiskOutputSchema.safeParse(result);
    if (!parsedResult.success) {
        console.error("Invalid response from prediction API:", parsedResult.error);
        return { error: 'Received an invalid response from the analysis service.' , riskAssessment: 'Error', confidenceScore: 0};
    }

    return parsedResult.data;

  } catch (error) {
    console.error("Error calling the prediction API:", error);
    // Return a structured error so the frontend can display it
    return { error: 'Analysis failed. Please try again later.', riskAssessment: 'Error', confidenceScore: 0 };
  }
}
