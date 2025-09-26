
import functions_framework
import numpy as np
import tensorflow as tf
from PIL import Image
import base64
import io
import os
from google.cloud import storage

# --- Configuration ---
# Hardcoded bucket and model file path to ensure correctness.
# The full gs:// path is provided here.
MODEL_FULL_PATH = "gs://sixai-cancer-models/oral_cervical_cancer_model.h5"
# --------------------

# This is a global variable to hold the model.
# It's loaded once per function instance to be reused across invocations.
model = None

def download_model_from_gcs(full_gcs_path):
    """Downloads the model from a full GCS path to a temporary local file."""
    try:
        # The full path is in the format "gs://<bucket-name>/<path-to-file>"
        # We need to parse the bucket name and the file path from this string.
        if not full_gcs_path.startswith("gs://"):
            raise ValueError("Invalid GCS path. Must start with 'gs://'.")
        
        # Remove the "gs://" prefix
        path_without_prefix = full_gcs_path[5:]
        # Split the path into bucket and blob name
        parts = path_without_prefix.split("/", 1)
        if len(parts) < 2:
            raise ValueError("Invalid GCS path format. Must be 'gs://<bucket>/<file>'.")
        
        bucket_name = parts[0]
        model_path = parts[1]

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(model_path)
        
        # Using /tmp/ is the standard location for temporary files in Cloud Functions
        local_model_path = f"/tmp/{os.path.basename(model_path)}"
        
        print(f"Downloading model {full_gcs_path} to {local_model_path}")
        blob.download_to_filename(local_model_path)
        print("Model downloaded successfully.")
        return local_model_path
    except Exception as e:
        print(f"CRITICAL: Failed to download model from GCS. Error: {e}")
        # This will likely cause the function to fail loading, which is intended.
        raise e

def load_model():
    """Loads the model into the global 'model' variable."""
    global model
    if model is None:
        try:
            # Download the model first using the full path
            local_path = download_model_from_gcs(MODEL_FULL_PATH)
            # Load the model from the local temporary path
            print("Loading model into memory...")
            model = tf.keras.models.load_model(local_path, compile=False)
            print("Model loaded successfully.")
        except Exception as e:
            # This print is crucial for debugging in Cloud Logging
            print(f"CRITICAL: Failed to load model. Error: {e}")
            model = None # Ensure model is None if loading fails

# Call load_model() at startup to load the model into the function's instance.
# This is "cold start" logic.
load_model()


@functions_framework.http
def predict(request):
    """
    HTTP Cloud Function to predict cancer risk from an image.
    The entry point function must be named 'predict'.
    """
    # Set CORS headers for all responses to allow requests from any origin
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if request.method == 'OPTIONS':
        # Handle CORS preflight request
        return ('', 204, headers)

    if not model:
        # If the model failed to load at startup, return a clear error.
        print("Error: Model is not loaded. Cannot process prediction.")
        return ({'error': 'Analysis failed: The AI model is not available. This could be due to a configuration or loading error. Please contact support.'}, 503, headers)

    request_json = request.get_json(silent=True)
    if not request_json or 'imageDataUri' not in request_json:
        return ({'error': 'Invalid request payload. Missing "imageDataUri".'}, 400, headers)
    
    image_data_uri = request_json['imageDataUri']
    
    try:
        # 1. Preprocess the Image
        # Expects a data URI like "data:image/jpeg;base64,..."
        header, encoded = image_data_uri.split(",", 1)
        image_data = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        # Ensure this is the correct input size for your model (e.g., 224x224)
        img_resized = image.resize((224, 224))
        
        # Normalize the image array to the [0, 1] range
        img_array = np.array(img_resized) / 255.0
        # Add a batch dimension
        img_batch = np.expand_dims(img_array, axis=0)

        # 2. Make Prediction using the loaded model
        prediction = model.predict(img_batch)
        
        # The output of model.predict is a numpy array, e.g., [[0.1, 0.9]]
        # We need to convert numpy types to standard Python types for JSON serialization.
        confidence_score = float(np.max(prediction))
        predicted_class_index = int(np.argmax(prediction))

        # 3. Format the Response
        # Assuming class 1 is 'High Risk' and class 0 is 'Low Risk'
        # Adjust this logic based on how your model was trained.
        risk_assessment = 'High Risk' if predicted_class_index == 1 else 'Low Risk'

        response_data = {
            "riskAssessment": risk_assessment,
            "confidenceScore": confidence_score
        }
        
        return (response_data, 200, headers)

    except Exception as e:
        # Log the full error for debugging
        print(f"Error during prediction processing: {e}")
        # Return a generic but informative error to the client
        return ({'error': f'An unexpected error occurred during image processing or prediction. Please check if the image format is correct.'}, 500, headers)
