import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useTheme } from './ThemeContext';
import { ClipLoader } from 'react-spinners';
import toast, { Toaster } from 'react-hot-toast';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const { theme, toggleTheme } = useTheme();

  // ---- User profile (localStorage) ----
  const [savedSkinType, setSavedSkinType] = useState(() => {
    return localStorage.getItem('neuroskin-skinType') || 'normal';
  });
  const [skinType, setSkinType] = useState(savedSkinType);
  useEffect(() => {
    localStorage.setItem('neuroskin-skinType', skinType);
  }, [skinType]);

  // ---- Drag & drop ----
  const [selectedImage, setSelectedImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': [] },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedImage(file);
        setPreview(URL.createObjectURL(file));
        resetToUpload();
      }
    },
    maxFiles: 1
  });

  // ---- State variables ----
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSeverity, setShowSeverity] = useState(false);
  const [affectedArea, setAffectedArea] = useState(0);
  const [severityResult, setSeverityResult] = useState(null);
  const [showChatbot, setShowChatbot] = useState(false);
  const [symptoms, setSymptoms] = useState({
    itching: false,
    redness: false,
    pain: false,
    bleeding: false,
    roughness: false
  });
  const [refinedPredictions, setRefinedPredictions] = useState([]);
  const [recommendations, setRecommendations] = useState(null);

  // ---- Collapsible sections ----
  const [showRecommendations, setShowRecommendations] = useState(true);
  const [showPredictionsTable, setShowPredictionsTable] = useState(true);

  // ---- Reset functions ----
  const resetToUpload = () => {
    setPredictions([]);
    setRefinedPredictions([]);
    setShowChatbot(false);
    setShowSeverity(false);
    setSeverityResult(null);
    setRecommendations(null);
    setError('');
    setSymptoms({
      itching: false,
      redness: false,
      pain: false,
      bleeding: false,
      roughness: false
    });
    setAffectedArea(0);
  };

  const resetApp = () => {
    setSelectedImage(null);
    setPreview(null);
    resetToUpload();
  };

  // ---- Helper: show error toast & shake effect ----
  const showError = (msg) => {
    setError(msg);
    toast.error(msg);
    const appDiv = document.querySelector('.App');
    appDiv.classList.add('shake');
    setTimeout(() => appDiv.classList.remove('shake'), 500);
  };

  // ---- API calls (unchanged) ----
  const handleUpload = async () => {
    if (!selectedImage) {
      showError('Please select an image first');
      return;
    }
    const formData = new FormData();
    formData.append('image', selectedImage);
    setLoading(true);
    setError('');
    resetToUpload();
    try {
      const response = await axios.post('http://localhost:5000/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (response.data.success) {
        setPredictions(response.data.predictions);
        setShowChatbot(true);
        toast.success('Image analysed! Now answer a few questions.');
      } else {
        showError('Prediction failed');
      }
    } catch (err) {
      showError('Error connecting to server. Make sure Flask is running on port 5000');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSymptomChange = (symptom) => {
    setSymptoms(prev => ({ ...prev, [symptom]: !prev[symptom] }));
  };

  const handleRefineWithSymptoms = async () => {
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/refine-with-symptoms', {
        symptoms: symptoms,
        predictions: predictions
      });
      if (response.data.refined_predictions) {
        setRefinedPredictions(response.data.refined_predictions);
        setShowChatbot(false);
        setShowSeverity(true);
        toast.success('Symptoms recorded. Now assess severity.');
      }
    } catch (err) {
      showError('Error refining predictions with symptoms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeverityAnalysis = async () => {
    const topConfidence = refinedPredictions.length > 0 ? refinedPredictions[0].confidence : 0;
    const topDisease = refinedPredictions.length > 0 ? refinedPredictions[0].disease : 'Melanocytic Nevus';
    const symptomCount = Object.values(symptoms).filter(v => v === true).length;
    
    setLoading(true);
    try {
      const severityResponse = await axios.post('http://localhost:5000/severity', {
        affected_area: affectedArea,
        symptom_count: symptomCount,
        confidence: topConfidence
      });
      if (severityResponse.data) {
        setSeverityResult(severityResponse.data);
        const recResponse = await axios.post('http://localhost:5000/recommendations', {
          disease: topDisease,
          severity: severityResponse.data.severity,
          skin_type: skinType
        });
        if (recResponse.data) {
          setRecommendations(recResponse.data);
          toast.success('Recommendations ready!');
        }
        setShowSeverity(false);
      }
    } catch (err) {
      showError('Error analyzing severity or fetching recommendations');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ---- PDF generation (unchanged, full function) ----
  const generatePDF = async () => {
    const reportContent = document.createElement('div');
    reportContent.style.padding = '30px';
    reportContent.style.backgroundColor = '#ffffff';
    reportContent.style.fontFamily = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif";
    reportContent.style.width = '650px';
    reportContent.style.borderRadius = '16px';
    reportContent.style.boxShadow = '0 10px 30px rgba(0,0,0,0.1)';
    
    const topPrediction = refinedPredictions[0];
    const isEmergency = (topPrediction?.disease === 'Melanoma' && topPrediction?.confidence > 80 && severityResult?.severity === 'Severe');
    
    reportContent.innerHTML = `
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="font-size: 48px;">🩺</div>
        <h1 style="color: #2c3e50; margin: 10px 0 5px;">NeuroSkin Report</h1>
        <p style="color: #7f8c8d; font-size: 12px;">Generated on ${new Date().toLocaleString()}</p>
        <hr style="border: 0; height: 2px; background: linear-gradient(90deg, #3498db, #2ecc71); margin: 15px 0;" />
      </div>
      
      <div style="margin-bottom: 25px; background: #f8f9fa; border-radius: 12px; padding: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0;">📸 Uploaded Image</h2>
        <img src="${preview}" style="max-width: 100%; border-radius: 12px; border: 1px solid #e0e0e0; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" />
      </div>
      
      <div style="margin-bottom: 25px; background: #f8f9fa; border-radius: 12px; padding: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0;">🎯 Final Diagnosis & Severity</h2>
        <div style="background-color: ${severityResult.severity === 'Mild' ? '#e8f8f5' : severityResult.severity === 'Moderate' ? '#fef9e7' : '#fdedec'}; padding: 15px; border-radius: 12px; border-left: 6px solid ${severityResult.severity === 'Mild' ? '#27ae60' : severityResult.severity === 'Moderate' ? '#f39c12' : '#e74c3c'};">
          <p style="margin: 5px 0;"><strong>Severity:</strong> ${severityResult.severity}</p>
          <p style="margin: 5px 0;"><strong>Score:</strong> ${severityResult.score}/100</p>
          <p style="margin: 5px 0;"><strong>Advice:</strong> ${severityResult.advice}</p>
        </div>
      </div>
      
      ${isEmergency ? `
      <div style="margin-bottom: 25px; background: linear-gradient(135deg, #ffebee, #ffcdd2); border-radius: 12px; padding: 20px; border-left: 6px solid #d32f2f;">
        <h2 style="color: #c62828; margin-top: 0;">⚠️ URGENT MEDICAL ALERT</h2>
        <p><strong>Melanoma detected with high confidence (${topPrediction.confidence}%) and classified as SEVERE.</strong></p>
        <p>Please seek immediate dermatological consultation.</p>
        <p><strong>Emergency Contact:</strong> 102 (Ambulance)</p>
      </div>
      ` : ''}
      
      <div style="margin-bottom: 25px; background: #f8f9fa; border-radius: 12px; padding: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0;">💊 Medicine & Care Recommendations</h2>
        <div style="margin-bottom: 15px;">
          <h3 style="color: #27ae60;">🟢 Over-the-Counter (OTC)</h3>
          <ul style="margin: 0; padding-left: 20px;">${recommendations?.otc_medicines.map(item => `<li style="margin: 5px 0;">${item}</li>`).join('') || '<li>None</li>'}</ul>
        </div>
        <div style="margin-bottom: 15px;">
          <h3 style="color: #e67e22;">🔵 Prescription (Consult Doctor)</h3>
          <ul style="margin: 0; padding-left: 20px;">${recommendations?.prescription_medicines.map(item => `<li style="margin: 5px 0;">${item}</li>`).join('') || '<li>None</li>'}</ul>
        </div>
        <div>
          <h3 style="color: #3498db;">📋 Self-Care Advice</h3>
          <p style="background: #eef2f7; padding: 12px; border-radius: 8px;">${recommendations?.advice || 'No specific advice.'}</p>
        </div>
      </div>
      
      <div style="background: #f8f9fa; border-radius: 12px; padding: 20px;">
        <h2 style="color: #2c3e50; margin-top: 0;">📊 Top Predictions (with Symptom Refinement)</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #3498db; color: white;">
              <th style="padding: 10px; text-align: left; border-radius: 8px 0 0 0;">Disease</th>
              <th style="padding: 10px; text-align: left;">Confidence</th>
              <th style="padding: 10px; text-align: left;">Original Confidence</th>
             </tr>
          </thead>
          <tbody>
            ${refinedPredictions.slice(0,5).map((pred, idx) => `
              <tr style="background: ${idx % 2 === 0 ? '#fff' : '#f1f1f1'};">
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${pred.disease}</td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${pred.confidence}%</td>
                <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${pred.original_confidence}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #95a5a6;">
        <p>This report was generated automatically by NeuroSkin AI. Not a substitute for professional medical advice.</p>
      </div>
    `;
    
    document.body.appendChild(reportContent);
    try {
      const canvas = await html2canvas(reportContent, { scale: 2, logging: false });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      pdf.save('NeuroSkin_Report.pdf');
    } catch (error) {
      console.error('PDF generation failed:', error);
      toast.error('PDF generation failed');
    } finally {
      document.body.removeChild(reportContent);
    }
  };

  // ---- Progress stepper logic ----
  let currentStep = 0;
  if (!predictions.length && !refinedPredictions.length && !severityResult) currentStep = 1;
  else if (showChatbot) currentStep = 2;
  else if (showSeverity) currentStep = 3;
  else if (severityResult) currentStep = 4;

  // ---- Skeleton loader ----
  const SkeletonPredictions = () => (
    <div className="skeleton-list">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton-prediction">
          <div className="skeleton-title"></div>
          <div className="skeleton-bar"></div>
        </div>
      ))}
    </div>
  );

  // ---- Helper: render predictions (old style, used for initial predictions and skip severity) ----
  const renderPredictions = (predictionsArray, showOriginal = false) => {
    if (loading && (!predictionsArray || predictionsArray.length === 0)) {
      return <SkeletonPredictions />;
    }
    return predictionsArray.slice(0,5).map((pred, idx) => (
      <div key={idx} className="prediction">
        <h3>{pred.disease}</h3>
        <div className="confidence-bar">
          <div className="confidence-fill" style={{ width: `${pred.confidence}%` }}>
            {pred.confidence}%
          </div>
        </div>
        {showOriginal && <small>Original: {pred.original_confidence}% | Symptom-adjusted</small>}
      </div>
    ));
  };

  // ---- Main render ----
  return (
    <div className="App">
      <Toaster position="top-right" reverseOrder={false} />
      {/* Header */}
      <div className="header">
        <div className="logo-title">
          <span className="logo">🩺</span>
          <h1>NeuroSkin</h1>
        </div>
        <div className="theme-toggle">
          <button onClick={toggleTheme} className="theme-btn">
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>
        </div>
      </div>

      {/* Progress Stepper */}
      <div className="stepper">
        <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>1. Upload</div>
        <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>2. Symptoms</div>
        <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>3. Severity</div>
        <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>4. Results</div>
      </div>

      {/* Drag & Drop Area */}
      {!selectedImage && (
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          {isDragActive ? <p>Drop the image here ...</p> : <p>Drag & drop a skin image here, or click to select</p>}
        </div>
      )}

      {/* Image Preview Card */}
      {preview && (
        <div className="image-card">
          <img src={preview} alt="Preview" className="preview" />
          <button onClick={() => { setSelectedImage(null); setPreview(null); resetToUpload(); }} className="change-image-btn">
            Change Image
          </button>
        </div>
      )}

      {/* Upload button */}
      {selectedImage && currentStep === 1 && (
        <button onClick={handleUpload} disabled={loading} className="primary-btn">
          {loading ? <ClipLoader color="white" size={20} /> : 'Predict Disease'}
        </button>
      )}

      {error && <div className="error hidden">{error}</div>}

      {/* Step 1: Initial predictions */}
      {predictions.length > 0 && !refinedPredictions.length && !showChatbot && !showSeverity && !severityResult && (
        <div>
          <h2>Initial Predictions (Top 5)</h2>
          {renderPredictions(predictions)}
          <div className="button-group">
            <button onClick={() => setShowChatbot(true)} className="secondary-btn">🤖 Refine with Symptoms</button>
            <button onClick={resetApp} className="secondary-btn">Upload New Image</button>
          </div>
        </div>
      )}

      {/* Step 2: Symptom Chatbot */}
      {showChatbot && (
        <div className="chatbot">
          <h2>Symptom Checker</h2>
          <p>Please answer a few questions to improve accuracy:</p>
          <div className="symptom-list">
            <label><input type="checkbox" checked={symptoms.itching} onChange={() => handleSymptomChange('itching')} /> 🔥 Itching or burning?</label>
            <label><input type="checkbox" checked={symptoms.redness} onChange={() => handleSymptomChange('redness')} /> ❤️ Redness or inflammation?</label>
            <label><input type="checkbox" checked={symptoms.pain} onChange={() => handleSymptomChange('pain')} /> 💢 Pain or tenderness?</label>
            <label><input type="checkbox" checked={symptoms.bleeding} onChange={() => handleSymptomChange('bleeding')} /> 🩸 Bleeding or oozing?</label>
            <label><input type="checkbox" checked={symptoms.roughness} onChange={() => handleSymptomChange('roughness')} /> 📍 Rough or scaly texture?</label>
          </div>
          <div className="skin-type-group">
            <label>🧴 Your Skin Type:</label>
            <select value={skinType} onChange={(e) => setSkinType(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="oily">Oily</option>
              <option value="dry">Dry</option>
              <option value="sensitive">Sensitive</option>
            </select>
          </div>
          <div className="button-group">
            <button onClick={handleRefineWithSymptoms} disabled={loading} className="primary-btn">
              {loading ? <ClipLoader color="white" size={20} /> : 'Get Refined Prediction'}
            </button>
            <button onClick={() => setShowChatbot(false)} className="secondary-btn">Skip</button>
          </div>
        </div>
      )}

      {/* Step 3: Severity Assessment */}
      {showSeverity && refinedPredictions.length > 0 && (
        <div className="chatbot">
          <h2>Severity Assessment</h2>
          <p>Approximately what percentage of your skin is affected?</p>
          <input type="range" min="0" max="100" value={affectedArea} onChange={(e) => setAffectedArea(parseInt(e.target.value))} />
          <div className="affected-value">{affectedArea}%</div>
          <div className="button-group">
            <button onClick={handleSeverityAnalysis} disabled={loading} className="primary-btn">
              {loading ? <ClipLoader color="white" size={20} /> : 'Get Severity Result'}
            </button>
            <button onClick={() => setShowSeverity(false)} className="secondary-btn">Skip</button>
          </div>
        </div>
      )}

      {/* ===== STEP 4: RESULTS (CLINICAL REDESIGN) ===== */}
      {refinedPredictions.length > 0 && !showChatbot && !showSeverity && severityResult && (
        <div className="results">
          {/* Severity Card */}
          <div className={`severity-card ${severityResult.severity.toLowerCase()}`}>
            <h3>Final Severity Assessment</h3>
            <div className="severity-score">{severityResult.score}/100</div>
            <p>{severityResult.advice}</p>
          </div>

          {/* Emergency Alert */}
          {(() => {
            const topPrediction = refinedPredictions[0];
            const isMelanoma = topPrediction?.disease === 'Melanoma';
            const isHighConfidence = topPrediction?.confidence > 80;
            const isSevere = severityResult.severity === 'Severe';
            if (isMelanoma && isHighConfidence && isSevere) {
              return (
                <div className="emergency-alert">
                  <div className="emergency-icon">⚠️ 🚨</div>
                  <h2>URGENT MEDICAL ALERT</h2>
                  <p><strong>Melanoma detected with high confidence ({topPrediction.confidence}%) and classified as SEVERE.</strong></p>
                  <p>Please seek immediate dermatological consultation.</p>
                  <div className="emergency-contact">
                    <h3>Emergency Contact:</h3>
                    <p>📞 Hospital Emergency: <strong>102</strong> (Ambulance)</p>
                    <p>📞 Dermatology Helpline: <strong>1800-XXX-XXXX</strong></p>
                  </div>
                  <button onClick={() => window.open('https://www.google.com/maps/search/hospital+near+me', '_blank')} className="emergency-btn">
                    🏥 Find Nearest Hospital
                  </button>
                </div>
              );
            }
            return null;
          })()}

          {/* Collapsible Medicine Recommendations */}
          <div className="collapsible">
            <button onClick={() => setShowRecommendations(!showRecommendations)} className="collapsible-header">
              {showRecommendations ? '▼' : '▶'} 💊 Medicine & Care Recommendations
            </button>
            {showRecommendations && recommendations && (
              <div className="recommendations-card">
                <div className="rec-section">
                  <h4>🟢 Over-the-Counter (OTC)</h4>
                  <ul>{recommendations.otc_medicines.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
                <div className="rec-section">
                  <h4>🔵 Prescription (Consult Doctor)</h4>
                  <ul>{recommendations.prescription_medicines.map((item, i) => <li key={i}>{item}</li>)}</ul>
                </div>
                <div className="rec-section advice">
                  <h4>📋 Self-Care Advice</h4>
                  <p>{recommendations.advice}</p>
                </div>
              </div>
            )}
          </div>

          {/* Refined Predictions with Probability Bars (Clinical Style) */}
          <h2>📊 Refined Predictions</h2>
          {refinedPredictions.slice(0,5).map((pred, idx) => {
            // Determine color class based on disease and confidence
            let barColorClass = 'neutral';
            if (pred.disease === 'Melanoma' && pred.confidence > 70) {
              barColorClass = 'high-risk';
            } else if (pred.disease === 'Melanoma' && pred.confidence > 40) {
              barColorClass = 'warning';
            } else if (pred.confidence > 70) {
              barColorClass = 'warning';
            } else if (pred.confidence > 40) {
              barColorClass = 'low-risk';
            } else {
              barColorClass = 'neutral';
            }
            return (
              <div key={idx} className="prediction-item">
                <div className="prediction-title">{pred.disease}</div>
                <div className="confidence-container">
                  <div className="confidence-bar-wrapper">
                    <div
                      className={`confidence-bar-fill ${barColorClass}`}
                      style={{ width: `${pred.confidence}%` }}
                    ></div>
                  </div>
                  <div className="confidence-percentage">{pred.confidence}%</div>
                </div>
                <div className="original-confidence">
                  Original: {pred.original_confidence}%
                </div>
              </div>
            );
          })}

          {/* Action Buttons */}
          <div className="button-group">
            <button onClick={generatePDF} className="btn-primary">
              📄 Download PDF Report
            </button>
            <button onClick={resetApp} className="btn-secondary">
              Analyze Another Image
            </button>
          </div>
        </div>
      )}

      {/* If severity was skipped */}
      {refinedPredictions.length > 0 && !showChatbot && !showSeverity && !severityResult && (
        <div>
          <h2>Refined Predictions (Symptom‑adjusted)</h2>
          {renderPredictions(refinedPredictions)}
          <div className="button-group">
            <button onClick={() => setShowSeverity(true)} className="secondary-btn">📊 Assess Severity</button>
            <button onClick={resetApp} className="secondary-btn">Analyze Another Image</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
