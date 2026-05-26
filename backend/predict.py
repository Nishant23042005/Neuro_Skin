import tensorflow as tf
import numpy as np
from tensorflow.keras.preprocessing import image
import os

# Load the trained model
model = tf.keras.models.load_model('skin_model.h5')

# Disease class mapping (same order as training)
class_names = [
    'Actinic Keratoses',
    'Basal Cell Carcinoma',
    'Benign Keratosis',
    'Dermatofibroma',
    'Melanoma',
    'Melanocytic Nevus',
    'Vascular Lesion'
]

def predict_skin_disease(img_path):
    """Predict skin disease from image path"""
    # Load and preprocess image
    img = image.load_img(img_path, target_size=(224, 224))
    img_array = image.img_to_array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    # Predict
    predictions = model.predict(img_array)[0]
    
    # Get top 3 predictions
    top_indices = np.argsort(predictions)[::-1][:3]
    results = []
    for idx in top_indices:
        results.append({
            'disease': class_names[idx],
            'confidence': float(predictions[idx]) * 100
        })
    
    return results

# Test with a sample image from your test set
if __name__ == '__main__':
    # Find one test image
    test_dir = 'organized_data/test'
    for disease_folder in os.listdir(test_dir):
        disease_path = os.path.join(test_dir, disease_folder)
        if os.path.isdir(disease_path):
            images = [f for f in os.listdir(disease_path) if f.endswith('.jpg')]
            if images:
                sample_img = os.path.join(disease_path, images[0])
                print(f"Testing on: {sample_img}")
                results = predict_skin_disease(sample_img)
                print("\nPredictions:")
                for i, res in enumerate(results, 1):
                    print(f"{i}. {res['disease']}: {res['confidence']:.2f}%")
                break