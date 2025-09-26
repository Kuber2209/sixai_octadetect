import functions_framework
import numpy as np
import tensorflow as tf
from PIL import Image
import base64
import io

# --- Configuration ---
BUCKET_NAME = "sixai-cancer-models"
MODEL_FILE_PATH = "oral_cervical_cancer_model.h5"
# --------------------

# Construct the full GCS path
gcs_model_path = f'gs://sixai-cancer-models/oral_cervical_cancer_model.h5'

# Load the model directly from GCS at startup
model = None
try:
    print(f"Loading model from: {gcs_model_path}")
    # This is the most direct and standard way to load from GCS.
    model = tf.keras.models.load_model(gcs_model_path, compile=False)
    print("Model loaded successfully directly from GCS.")
except Exception as e:
    model = None
    # This print statement is crucial for debugging
    print(f"CRITICAL: Failed to load model from GCS. Error: {e}")


@functions_framework.http
def predict(request):
    """
    HTTP Cloud Function to predict cancer risk from an image.
    The entry point function must be named 'predict'.
    """
    # Set CORS headers for all responses
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if request.method == 'OPTIONS':
        return ('', 204, headers)

    if not model:
        # If the model failed to load at startup, return this error.
        return ({'error': 'Analysis failed: The AI model is not available. Please contact support.'}, 503, headers)

    request_json = request.get_json(silent=True)
    if not request_json or 'imageDataUri' not in request_json:
        return ({'error': 'Invalid request payload. Missing "imageDataUri".'}, 400, headers)
    
    image_data_uri = request_json['imageDataUri']
    
    try:
        # 1. Preprocess the Image
        header, encoded = image_data_uri.split(",", 1)
        image_data = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Ensure this is the correct input size for your model
        img_resized = image.resize((224, 224))
        
        img_array = np.array(img_resized) / 255.0
        img_batch = np.expand_dims(img_array, axis=0)

        # 2. Make Prediction
        prediction = model.predict(img_batch)
        
        confidence_score = float(np.max(prediction))
        predicted_class_index = int(np.argmax(prediction))

        # 3. Format the Response
        risk_assessment = 'High Risk' if predicted_class_index == 1 else 'Low Risk'

        response_data = {
            "riskAssessment": risk_assessment,
            "confidenceScore": confidence_score,
            "cancerType": "Oral Cancer",
        }
        
        return (response_data, 200, headers)

    except Exception as e:
        print(f"Error during prediction: {e}")
        return ({'error': f'An error occurred during prediction: {str(e)}'}, 500, headers)