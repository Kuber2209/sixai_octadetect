
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
MODEL_FULL_PATH = "gs://sixai-cancer-models/oral_cervical_cancer_model.h5"
# --------------------

# This is a global variable to hold the model.
# It's loaded once per function instance to be reused across invocations.
model = None

# Mapping from image type string to an integer index for the model
TYPE_MAPPING = {
  "Clinical": 0,
  "Clinical and Radiograph": 1,
  "Histopathology": 2,
  "Radiograph": 3
}

def download_model_from_gcs(full_gcs_path):
    """Downloads the model from a full GCS path to a temporary local file."""
    try:
        if not full_gcs_path.startswith("gs://"):
            raise ValueError("Invalid GCS path. Must start with 'gs://'.")
        
        path_without_prefix = full_gcs_path[5:]
        parts = path_without_prefix.split("/", 1)
        if len(parts) < 2:
            raise ValueError("Invalid GCS path format. Must be 'gs://<bucket>/<file>'.")
        
        bucket_name, model_path = parts
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(model_path)
        
        local_model_path = f"/tmp/{os.path.basename(model_path)}"
        print(f"Downloading model {full_gcs_path} to {local_model_path}")
        blob.download_to_filename(local_model_path)
        print("Model downloaded successfully.")
        return local_model_path
    except Exception as e:
        print(f"CRITICAL: Failed to download model from GCS. Error: {e}")
        raise e

def load_model():
    """Loads the model into the global 'model' variable."""
    global model
    if model is None:
        try:
            local_path = download_model_from_gcs(MODEL_FULL_PATH)
            print("Loading model into memory...")
            model = tf.keras.models.load_model(local_path, compile=False)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"CRITICAL: Failed to load model. Error: {e}")
            model = None

# Load the model at startup
load_model()


@functions_framework.http
def predict(request):
    """
    HTTP Cloud Function to predict cancer risk from an image and its type.
    """
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }
    if request.method == 'OPTIONS':
        return ('', 204, headers)

    if not model:
        print("Error: Model is not loaded. Cannot process prediction.")
        return ({'error': 'Analysis failed: The AI model is not available. Please check the function logs for loading errors.'}, 503, headers)

    request_json = request.get_json(silent=True)
    if not request_json or 'imageDataUri' not in request_json or 'imageType' not in request_json:
        return ({'error': 'Invalid request payload. Missing "imageDataUri" or "imageType".'}, 400, headers)
    
    image_data_uri = request_json['imageDataUri']
    image_type_str = request_json['imageType']
    
    try:
        # 1. Preprocess the Image
        header, encoded = image_data_uri.split(",", 1)
        image_data = base64.b64decode(encoded)
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_resized = image.resize((224, 224))
        img_array = np.array(img_resized) / 255.0
        img_batch = np.expand_dims(img_array, axis=0) # Shape: [1, 224, 224, 3]

        # 2. Preprocess the Image Type
        if image_type_str not in TYPE_MAPPING:
            return ({'error': f'Invalid imageType: "{image_type_str}".'}, 400, headers)
        
        type_idx = TYPE_MAPPING[image_type_str]
        # Create a tensor with shape [1] for the type index
        type_tensor = np.array([type_idx], dtype=np.int32)

        # 3. Make Prediction using both inputs
        print(f"Predicting with image and type index: {type_idx}")
        # The model expects a list of inputs
        prediction = model.predict([img_batch, type_tensor])
        
        confidence_score = float(np.max(prediction))
        predicted_class_index = int(np.argmax(prediction))

        # 4. Format the Response
        risk_assessment = 'High Risk' if predicted_class_index == 1 else 'Low Risk'

        response_data = {
            "riskAssessment": risk_assessment,
            "confidenceScore": confidence_score
        }
        
        return (response_data, 200, headers)

    except Exception as e:
        print(f"Error during prediction processing: {e}")
        return ({'error': f'An unexpected error occurred during processing or prediction.'}, 500, headers)

