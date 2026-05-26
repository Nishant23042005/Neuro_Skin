from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
import base64
from tensorflow.keras.preprocessing import image
import io
from PIL import Image
import os

app = Flask(__name__)
CORS(app)  # basic CORS

# ----- Explicit CORS headers for every response (including preflight) -----
@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', 'http://localhost:3000')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.add('Access-Control-Allow-Credentials', 'true')
    return response
# -------------------------------------------------------------------------

print("Loading model...")
model = tf.keras.models.load_model('skin_model.h5')
print("Model loaded successfully!")

class_names = [
    'Actinic Keratoses',
    'Basal Cell Carcinoma',
    'Benign Keratosis',
    'Dermatofibroma',
    'Melanoma',
    'Melanocytic Nevus',
    'Vascular Lesion'
]

def preprocess_image(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    img = img.resize((224, 224))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    return img_array

@app.route('/predict', methods=['POST'])
def predict():
    if 'image' not in request.files:
        return jsonify({'error': 'No image uploaded'}), 400
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400
    img_bytes = file.read()
    img_array = preprocess_image(img_bytes)
    predictions = model.predict(img_array)[0]
    top_indices = np.argsort(predictions)[::-1]
    results = []
    for idx in top_indices:
        results.append({
            'disease': class_names[idx],
            'confidence': round(float(predictions[idx]) * 100, 2)
        })
    return jsonify({'success': True, 'predictions': results})

@app.route('/refine-with-symptoms', methods=['POST'])
def refine_with_symptoms():
    data = request.json
    symptoms = data.get('symptoms', {})
    original_predictions = data.get('predictions', [])
    
    disease_symptom_map = {
        'Melanoma': {'itching': False, 'redness': False, 'pain': False, 'bleeding': True},
        'Melanocytic Nevus': {'itching': False, 'redness': False, 'pain': False, 'bleeding': False},
        'Benign Keratosis': {'itching': False, 'redness': False, 'pain': False, 'roughness': True},
        'Actinic Keratoses': {'itching': False, 'redness': True, 'pain': False, 'roughness': True},
        'Basal Cell Carcinoma': {'itching': False, 'redness': True, 'pain': False, 'bleeding': True},
        'Dermatofibroma': {'itching': True, 'redness': False, 'pain': False, 'firmness': True},
        'Vascular Lesion': {'itching': False, 'redness': True, 'pain': False, 'swelling': True},
        'Eczema': {'itching': True, 'redness': True, 'pain': False, 'dryness': True},
        'Psoriasis': {'itching': True, 'redness': True, 'pain': True, 'scaling': True}
    }
    
    symptom_scores = {}
    for disease, mapping in disease_symptom_map.items():
        if not symptoms:
            symptom_scores[disease] = 0.5
        else:
            matches = 0
            for sym, present in symptoms.items():
                if sym in mapping and mapping[sym] == present:
                    matches += 1
            symptom_scores[disease] = matches / len(symptoms)
    
    refined = []
    for pred in original_predictions:
        disease = pred['disease']
        original_conf = pred['confidence'] / 100.0
        sym_score = symptom_scores.get(disease, 0.5)
        new_conf = original_conf * (0.7 + 0.3 * sym_score)
        refined.append({
            'disease': disease,
            'confidence': round(new_conf * 100, 2),
            'original_confidence': pred['confidence']
        })
    refined.sort(key=lambda x: x['confidence'], reverse=True)
    return jsonify({'refined_predictions': refined})

@app.route('/severity', methods=['POST'])
def severity_analysis():
    data = request.json
    affected_area_percent = data.get('affected_area', 0)
    symptom_count = data.get('symptom_count', 0)
    confidence = data.get('confidence', 0)
    score = (affected_area_percent * 0.4) + (symptom_count * 10) + (confidence * 0.3)
    score = min(100, max(0, score))
    if score < 30:
        severity = "Mild"
        advice = "Monitor the area. Use over-the-counter moisturizer. Consult if worsens."
    elif score < 70:
        severity = "Moderate"
        advice = "Consult a dermatologist. Avoid scratching. Apply prescribed cream."
    else:
        severity = "Severe"
        advice = "URGENT: See a dermatologist immediately. Do not delay treatment."
    return jsonify({'severity': severity, 'score': round(score, 1), 'advice': advice})

@app.route('/recommendations', methods=['POST'])
def get_recommendations():
    data = request.json
    disease = data.get('disease', '')
    severity = data.get('severity', 'Moderate')
    skin_type = data.get('skin_type', 'normal').lower()  # <-- NEW: accept skin type

    # Base recommendations database
    recommendations_db = {
        'Melanoma': {
            'Mild': {'otc': ['Sunscreen SPF 50+', 'Moisturizer with aloe vera'], 'prescription': ['Imiquimod cream (consult dermatologist)'], 'advice': 'Monitor mole changes. Avoid sun exposure. Regular skin checks.'},
            'Moderate': {'otc': ['Antiseptic cream', 'Hydrocolloid dressing'], 'prescription': ['Fluorouracil cream', 'Consult for possible excision'], 'advice': 'Schedule dermatologist appointment. Do not scratch. Keep area clean.'},
            'Severe': {'otc': ['Pain reliever (ibuprofen if tolerated)'], 'prescription': ['Urgent surgical referral', 'Immunotherapy evaluation'], 'advice': 'SEEK IMMEDIATE MEDICAL CARE. Do not delay treatment.'}
        },
        'Melanocytic Nevus': {
            'Mild': {'otc': ['Gentle cleanser', 'Moisturizer'], 'prescription': ['None needed (benign)'], 'advice': 'Normal mole. Monitor for changes. Use sun protection.'},
            'Moderate': {'otc': ['Sunscreen SPF 30+', 'Calming lotion'], 'prescription': ['Consult if changes occur'], 'advice': 'Consider dermatologist mapping. Avoid picking.'},
            'Severe': {'otc': ['Antibiotic ointment if irritated'], 'prescription': ['Biopsy evaluation'], 'advice': 'Get professional examination.'}
        },
        'Benign Keratosis': {
            'Mild': {'otc': ['Salicylic acid cream', 'Urea-based moisturizer'], 'prescription': ['Tretinoin cream (low strength)'], 'advice': 'Avoid scratching. Use gentle exfoliation.'},
            'Moderate': {'otc': ['Cryotherapy kits (OTC)', 'Keratolytic lotion'], 'prescription': ['Liquid nitrogen treatment (in-office)'], 'advice': 'Dermatologist can remove if bothersome.'},
            'Severe': {'otc': ['Bandages for protection'], 'prescription': ['Shave excision or electrocautery'], 'advice': 'See dermatologist for removal.'}
        },
        'Actinic Keratoses': {
            'Mild': {'otc': ['Sunscreen SPF 50', 'Vitamin C serum'], 'prescription': ['Fluorouracil cream (low strength)'], 'advice': 'Sun protection essential. Reapply sunscreen every 2 hours.'},
            'Moderate': {'otc': ['Aloe vera gel', 'Gentle exfoliant'], 'prescription': ['Imiquimod cream', 'Cryotherapy'], 'advice': 'Dermatologist treatment recommended.'},
            'Severe': {'otc': ['Pain relief gel (lidocaine OTC)'], 'prescription': ['Photodynamic therapy', 'Surgical excision'], 'advice': 'Urgent dermatology consult. May be precancerous.'}
        },
        'Basal Cell Carcinoma': {
            'Mild': {'otc': ['Antiseptic wash', 'Sunscreen'], 'prescription': ['Imiquimod cream (supervised)'], 'advice': 'See dermatologist. Usually treatable if caught early.'},
            'Moderate': {'otc': ['Healing ointment', 'Sterile dressings'], 'prescription': ['Mohs surgery referral'], 'advice': 'Do not delay treatment. BCC grows slowly but invasively.'},
            'Severe': {'otc': ['Pain management (OTC analgesics)'], 'prescription': ['Urgent surgical consult', 'Radiotherapy evaluation'], 'advice': 'SEEK SPECIALIST IMMEDIATELY.'}
        },
        'Dermatofibroma': {
            'Mild': {'otc': ['Hydrocortisone cream (if itchy)'], 'prescription': ['None required'], 'advice': 'Benign. Leave alone unless symptomatic.'},
            'Moderate': {'otc': ['Moisturizer', 'Silicone gel sheet'], 'prescription': ['Intralesional steroid injection (by derm)'], 'advice': 'Avoid picking. Can be removed if painful.'},
            'Severe': {'otc': ['Bandages for protection'], 'prescription': ['Excisional biopsy'], 'advice': 'Consult dermatologist for removal.'}
        },
        'Vascular Lesion': {
            'Mild': {'otc': ['Concealer makeup', 'Sunscreen'], 'prescription': ['Pulsed dye laser (cosmetic)'], 'advice': 'Generally harmless. Laser therapy optional.'},
            'Moderate': {'otc': ['Cold compress if tender'], 'prescription': ['Laser or sclerotherapy consult'], 'advice': 'May resolve spontaneously. Monitor size.'},
            'Severe': {'otc': ['Pressure bandage'], 'prescription': ['Interventional radiology consult'], 'advice': 'See specialist if bleeding or growing rapidly.'}
        }
    }

    if disease not in recommendations_db:
        disease = 'Benign Keratosis'

    recs = recommendations_db[disease].get(severity, recommendations_db[disease]['Mild'])

    # Skin‑type specific OTC add‑ons and advice
    skin_type_addons = {
        'oily': ['Oil‑free moisturizer', 'Salicylic acid cleanser (for acne‑prone skin)'],
        'dry': ['Ceramide cream', 'Fragrance‑free rich moisturizer', 'Avoid alcohol‑based products'],
        'sensitive': ['Hypoallergenic moisturizer', 'Gentle cleanser', 'Patch test any new product'],
        'normal': ['Balanced moisturizer', 'Mild cleanser']
    }

    skin_tip = {
        'oily': 'Use non‑comedogenic products. Wash twice daily.',
        'dry': 'Apply moisturizer immediately after bathing. Use a humidifier.',
        'sensitive': 'Avoid harsh scrubs. Test products on a small area first.',
        'normal': 'Maintain a regular cleansing and moisturizing routine.'
    }

    # Merge OTC recommendations with skin‑type specific items
    otc_list = recs['otc'].copy()
    if skin_type in skin_type_addons:
        otc_list.extend(skin_type_addons[skin_type])
    # Remove duplicates while preserving order
    otc_list = list(dict.fromkeys(otc_list))

    extra_tip = skin_tip.get(skin_type, '')
    full_advice = recs['advice'] + ' ' + extra_tip if extra_tip else recs['advice']

    return jsonify({
        'disease': disease,
        'severity': severity,
        'otc_medicines': otc_list,
        'prescription_medicines': recs['prescription'],
        'advice': full_advice
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
