import functions_framework
import tensorflow as tf
import numpy as np
import json
import os
from google.cloud import storage
from tensorflow import keras
from sklearn.preprocessing import LabelEncoder
import base64
import io
from PIL import Image

# Configuration
BUCKET_NAME = 'sixai-cancer-models'
MODEL_FILE = 'oral_cervical_cancer_model.h5'
LOCAL_MODEL_PATH = '/tmp/' + MODEL_FILE
IMG_SIZE = (224, 224)

# Mapping from image type string to an integer index for the model
TYPE_MAPPING = {
  "Clinical": 0,
  "Clinical and Radiograph": 1,
  "Histopathology": 2,
  "Radiograph": 3
}

model = None

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
            # Hardcode the full path to the model for reliability
            full_model_path = f"gs://{BUCKET_NAME}/{MODEL_FILE}"
            local_path = download_model_from_gcs(full_model_path)
            print("Loading model into memory...")
            model = tf.keras.models.load_model(local_path, compile=False)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"CRITICAL: Failed to load model. Error: {e}")
            model = None # Ensure model is None if loading fails

# Load the model during the cold start
load_model()

@functions_framework.http
def predict(request):
    """HTTP Cloud Function for prediction."""
    # Set CORS headers for the preflight request
    if request.method == 'OPTIONS':
        # Allows GET requests from any origin with the Content-Type
        # header and caches preflight response for an 3600s
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '3600'
        }

        return ('', 204, headers)

    # Set CORS headers for the main request
    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    if not model:
        print("Error: Model is not loaded. Cannot process prediction.")
        return ({'error': 'Analysis failed: The AI model is not available. Please check the function logs.'}, 503, headers)

    if 'image' not in request.files or 'image_type' not in request.form:
        return ({'error': 'Missing image file or image_type in request'}, 400, headers)

    image_file = request.files['image']
    image_type_str = request.form['image_type']

    try:
        # 1. Preprocess the Image
        image_data = image_file.read()
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        img_resized = image.resize(IMG_SIZE)
        img_array = np.array(img_resized) / 255.0
        img_batch = np.expand_dims(img_array, axis=0) # Shape: [1, 224, 224, 3]

        # 2. Preprocess the Image Type
        if image_type_str not in TYPE_MAPPING:
            return ({'error': f'Invalid imageType: "{image_type_str}".'}, 400, headers)
        
        type_idx = TYPE_MAPPING[image_type_str]
        type_tensor = np.array([type_idx], dtype=np.int32)

        # 3. Make Prediction
        prediction = model.predict([img_batch, type_tensor])
        
        confidence_score = float(np.max(prediction))
        predicted_class_index = int(np.argmax(prediction))

        # 4. Format Response
        risk_assessment = 'High Risk' if predicted_class_index == 1 else 'Low Risk'

        response_data = {
            "riskAssessment": risk_assessment,
            "confidenceScore": confidence_score
        }
        
        return (response_data, 200, headers)

    except Exception as e:
        print(f"Prediction error: {e}")
        return ({'error': f'An unexpected error occurred during prediction: {e}'}, 500, headers)
