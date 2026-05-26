🩺 NeuroSkin – AI-Powered Skin Disease Predictor

NeuroSkin is a full-stack AI-powered web application that helps users identify potential skin diseases from uploaded images using deep learning. The platform combines image-based disease prediction, symptom analysis, severity assessment, and medicine recommendations to provide an intelligent preliminary skin health assistant.

It is designed to spread awareness about skin conditions and encourage users to seek professional medical consultation when necessary.

🌟 Features
🔍 AI Skin Disease Prediction
Upload a skin image and get predictions using a trained deep learning model.
Displays Top 5 predicted diseases with confidence percentages.
Uses transfer learning with MobileNetV2 for efficient classification.
🤖 Symptom-Based Chatbot
Interactive symptom questionnaire after prediction.
Refines disease probability based on symptoms like:
Itching
Redness
Burning sensation
Swelling
Pain
🧴 Personalized Skin Care Recommendations
Recommendations adapted to skin type:
Oily
Dry
Normal
Sensitive
Provides:
OTC medicines
Prescription suggestions
Self-care routines
📊 Severity Assessment
Calculates disease severity using:
Prediction confidence
Symptom count
Affected skin area %
Outputs:
Mild
Moderate
Severe
Generates personalized advice.
🚨 Emergency Alert System
Detects high-risk conditions such as Melanoma.
If:
Melanoma confidence > 80%
Severity = Severe
Then:
Displays urgent medical warning
Suggests emergency consultation.
📄 PDF Medical Report

Generate and download a professional PDF report containing:

Uploaded image preview
Final diagnosis
Severity score
Medicine recommendations
Prediction confidence table
Emergency alerts (if applicable)
🎨 Modern UI/UX
Fully responsive design
Dark / Light mode toggle
Smooth animations with Framer Motion
Drag & Drop image upload
Step-by-step progress tracker
🧠 Tech Stack
Layer	Technology
Frontend	React 18, Axios, Framer Motion, React Hot Toast, jsPDF, html2canvas
Backend	Flask, TensorFlow/Keras, OpenCV, Pillow
AI Model	MobileNetV2 Transfer Learning
Dataset	HAM10000 Skin Disease Dataset
Deployment	Render, Vercel, Netlify, Railway
🩻 Supported Disease Classes

The model is trained on HAM10000 dataset disease categories:

Disease	Description
Melanoma	Dangerous form of skin cancer
Basal Cell Carcinoma	Common skin cancer
Benign Keratosis	Non-cancerous skin growth
Actinic Keratoses	Precancerous lesion
Dermatofibroma	Benign skin nodule
Vascular Lesions	Blood vessel abnormalities
Nevus	Common mole
