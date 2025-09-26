import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const PREDICTION_API_URL = process.env.PREDICTION_API_URL;

  if (!PREDICTION_API_URL) {
    console.error('PREDICTION_API_URL is not set in environment variables.');
    return NextResponse.json(
      { error: 'Server configuration error: Prediction service URL not found.' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { imageDataUri, imageType } = body; // Destructure both fields

    if (!imageDataUri || !imageType) {
      return NextResponse.json(
        { error: 'Invalid request payload. Missing "imageDataUri" or "imageType".' },
        { status: 400 }
      );
    }
    
    // Forward the request to the Python Cloud Function
    const pythonBackendResponse = await fetch(PREDICTION_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        imageDataUri: imageDataUri,
        imageType: imageType // Pass both fields to the backend
      }),
    });

    if (!pythonBackendResponse.ok) {
      const errorBody = await pythonBackendResponse.text();
      console.error('Error from Python backend:', errorBody);
      // Try to parse the error from the python function
      let errorMessage = `Error from prediction service: ${pythonBackendResponse.statusText}`;
      try {
        const errorJson = JSON.parse(errorBody);
        if (errorJson.error) {
          errorMessage = errorJson.error;
        }
      } catch (e) {
        // Not a json error, use the text body if it's not too long
        if (errorBody.length < 500) {
           errorMessage = errorBody;
        }
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: pythonBackendResponse.status }
      );
    }

    const data = await pythonBackendResponse.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error('Error in proxy API route:', error);
    return NextResponse.json(
      { error: `An internal error occurred: ${error.message}` },
      { status: 500 }
    );
  }
}
