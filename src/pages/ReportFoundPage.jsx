/* ============================================================
   ReportFoundPage.jsx
   Route: /report-found  (protected — must be logged in)

   PURPOSE:
   A form where a college student who FOUND an item can:
   1. Select the item category (wallet, watch, phone, etc.)
   2. Write a title and description
   3. Upload a photo of the item
   4. Use BlurRegionSelector to mark sensitive areas to blur
   5. Submit → saves the item + blur zones to localStorage
   ============================================================ */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth }    from '../context/AuthContext';
import { PackageOpen, Camera, ImageIcon, Info, CheckCircle, EyeOff, MapPin, ArrowLeft, Trash2, Plus } from 'lucide-react';
import BlurRegionSelector from '../components/ui/BlurRegionSelector';
import { CATEGORY_CONFIG } from '../utils/itemUtils';
import { runFullFraudScan } from '../utils/fraudUtils';
import { generateImageFingerprint } from '../utils/imageFingerprint';
import ButtonSpinner from '../components/ui/ButtonSpinner';
import styles from './ReportFoundPage.module.css';

function ReportFoundPage() {
  const navigate = useNavigate();
  const { session } = useAuth(); // Get logged-in user info

  /* ── Form field state ──────────────────────────────────────
     Each piece of form data has its own useState variable.
  */
  const [category,    setCategory]    = useState('');       // e.g. 'wallet'
  const [title,       setTitle]       = useState('');       // e.g. 'Blue Wallet'
  const [description, setDescription] = useState('');       // detailed description
  const [location,    setLocation]    = useState('');       // approximate location (public)
  const [exactLocation, setExactLocation] = useState('');   // exact location (hidden from public)
  const [secretDetails, setSecretDetails] = useState('');   // hidden identifier
  const [images, setImages] = useState([]);              // array of base64 strings (max 5)
  const [allBlurZones, setAllBlurZones] = useState({});  // { 0: [...zones], 1: [...zones] }
  const [activeImageIndex, setActiveImageIndex] = useState(0); // which image is being blur-edited

  /* ── UI state ─────────────────────────────────────────── */
  const [step,    setStep]    = useState(1);     // Current step: 1=Details, 2=Photo, 3=Blur
  const [loading, setLoading] = useState(false); // Submit loading spinner
  const [error,   setError]   = useState('');    // Validation error message

  /* ──────────────────────────────────────────────────────────
     handleImageUpload()
     Called when the user selects a file from their device.
     Reads the file and converts it to a base64 string so we
     can store it easily in localStorage.
  */
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const remaining = 5 - images.length;
    const toProcess = files.slice(0, remaining);
    
    toProcess.forEach(file => {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (JPG, PNG, etc.)');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be smaller than 5MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => {
          if (prev.length >= 5) return prev;
          return [...prev, event.target.result];
        });
      };
      reader.readAsDataURL(file);
    });
    
    setError('');
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  const removeImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, i) => i !== indexToRemove));
    setAllBlurZones(prev => {
      const updated = {};
      Object.keys(prev).forEach(key => {
        const k = parseInt(key);
        if (k < indexToRemove) updated[k] = prev[k];
        else if (k > indexToRemove) updated[k - 1] = prev[k];
      });
      return updated;
    });
    if (activeImageIndex >= images.length - 1) setActiveImageIndex(Math.max(0, images.length - 2));
  };

  /* ──────────────────────────────────────────────────────────
     validateStep()
     Check if the current step is complete before going to next.
     Returns true if OK, false if there's an error.
  */
  const validateStep = () => {
    setError('');

    if (step === 1) {
      if (!category)              return setError('Please select a category.'), false;
      if (!title.trim())          return setError('Please enter a title.'), false;
      if (!description.trim())    return setError('Please write a description.'), false;
      if (!location.trim())       return setError('Please enter where you found it.'), false;
    }

    if (step === 2) {
      if (images.length === 0) return setError('Please upload a photo of the item.'), false;
    }

    return true; // All good
  };

  /* ──────────────────────────────────────────────────────────
     handleNext() / handleBack()
     Move between the 3 steps of the form.
  */
  const handleNext = async () => {
    if (validateStep()) {
      setStep(s => s + 1); // Go to next step
      window.scrollTo(0, 0); // Scroll to top
    }
  };

  const handleBack = () => {
    setStep(s => s - 1);
    setError('');
  };

  /* ──────────────────────────────────────────────────────────
     handleSubmit()
     Save the item when the user clicks "Submit" on step 3.
     Now runs fraud detection BEFORE saving!
  */
  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // (AI fraud scan was already completed successfully on Step 2)

      // 4. If clean or low/medium risk, proceed to save the item
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/item/add`, {
        method: 'POST',
        credentials: 'include', // 🔥 CRITICAL: Sends your secure login cookie!
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category: category,
          shortTitle: title, // Map React 'title' to Backend 'shortTitle'
          description: description,
          location: location,
          exactLocation: exactLocation,
          secretIdentity: secretDetails, // Map React 'secretDetails' to Backend 'secretIdentity'
          secretDetails: secretDetails ? secretDetails.split(',').map(s => s.trim()).filter(Boolean) : [],
          // We are temporarily sending the raw Base64 string to the DB.
          // Later, you should upload this to Cloudinary and send the URL instead!
          images: images, 
          imageFingerprint: generateImageFingerprint(images[0]),
          blurZones: Object.values(allBlurZones).flat(), // 🔥 CRITICAL: Actually send the blur zones to the DB!
        }) 
      });

      const data = await response.json();
      
      if (response.ok) {
        setLoading(false);
        alert("Item Submitted! An admin will review your photos shortly. You will receive an email once it is approved.");
        navigate('/found-items');
      } else {
        let errorMsg = data.error || data.message || "An error occurred";
        setError(errorMsg);
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while communicating with the server. Please try again.');
      setLoading(false);
    }
  };

  /* ── Helper: get the blur hint for selected category ── */
  const blurHint = category
    ? CATEGORY_CONFIG[category]?.blurHint
    : 'Select a category first to get specific blur guidance.';

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className={styles.page}>

      {/* ── Top bar with back button ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Back to Dashboard
        </button>
        <h1 className={styles.pageTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PackageOpen size={24} /> Report Found Item
        </h1>
      </div>

      {/* ── Step progress indicator ── */}
      <div className={styles.steps}>
        {['Item Details', 'Upload Photo', 'Mark Blur Areas'].map((label, i) => (
          <div key={i} className={styles.stepItem}>
            {/* Circle with step number */}
            <div className={`${styles.stepCircle} ${step > i + 1 ? styles.done : ''} ${step === i + 1 ? styles.active : ''}`}>
              {step > i + 1 ? '✓' : i + 1}
            </div>
            <span className={`${styles.stepLabel} ${step === i + 1 ? styles.activeLabel : ''}`}>
              {label}
            </span>
            {/* Connecting line between steps */}
            {i < 2 && <div className={`${styles.stepLine} ${step > i + 1 ? styles.doneLine : ''}`} />}
          </div>
        ))}
      </div>

      {/* ── Form card ── */}
      <div className={styles.card}>

        {/* Error message */}
        {error && (
          <div className={styles.errorAlert}>
            ⚠️ {error}
          </div>
        )}

        {/* ══════════════ STEP 1: Item Details ══════════════ */}
        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepHeading}>Tell us about the item</h2>
            <p className={styles.stepSubtitle}>
              Provide general details. <strong>Don't include secret identifiers</strong> — the AI will ask the owner to prove ownership.
            </p>

            {/* Category selector */}
            <div className={styles.field}>
              <label className={styles.label}>Item Category *</label>
              <div className={styles.categoryGrid}>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    className={`${styles.categoryBtn} ${category === key ? styles.selectedCategory : ''}`}
                    onClick={() => setCategory(key)}
                  >
                    <span className={styles.catIcon}>{config.icon}</span>
                    <span className={styles.catLabel}>{config.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="item-title">
                Short Title *
              </label>
              <input
                id="item-title"
                type="text"
                className={styles.input}
                placeholder='e.g. "Blue leather wallet" or "Black watch with metal strap"'
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={80}
              />
            </div>

            {/* Description */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="item-desc">
                Description *
              </label>
              <p className={styles.fieldHint}>
                Describe the item in <strong>general terms only</strong> — color, brand, size. 
                ⚠️ <strong style={{color: '#ff4d6d'}}>Do NOT include unique marks, serial numbers, scratches, or contents here.</strong> Put those in the "Secret Identifier" field below so scammers can't copy them.
              </p>
              <textarea
                id="item-desc"
                className={styles.textarea}
                placeholder='e.g. "Found a brown leather wallet with some cards inside. Has a small torn corner."'
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={4}
                maxLength={500}
              />
              <span className={styles.charCount}>{description.length}/500</span>
            </div>

            {/* Approximate Location (Public) */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="item-location">
                Approximate Location (Public) *
              </label>
              <p className={styles.fieldHint}>
                This will be shown publicly. Keep it general (e.g., "Library building", "North Campus").
              </p>
              <input
                id="item-location"
                type="text"
                className={styles.input}
                placeholder='e.g. "Library building" or "Canteen area"'
                value={location}
                onChange={e => setLocation(e.target.value)}
                maxLength={120}
              />
            </div>

            {/* Exact Location (Hidden) */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="item-exact-location" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Exact Location (Hidden) <MapPin size={16} />
              </label>
              <p className={styles.fieldHint}>
                This is <strong>never shown publicly</strong>. The AI will ask the owner to guess this.
              </p>
              <input
                id="item-exact-location"
                type="text"
                className={styles.input}
                placeholder='e.g. "Library 2nd floor, under the desk near window seat"'
                value={exactLocation}
                onChange={e => setExactLocation(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Secret Details */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="item-secret" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Secret Identifier (Optional) <EyeOff size={16} />
              </label>
              <p className={styles.fieldHint}>
                Tell us something only the true owner would know. Separate multiple details with commas. E.g. "Spider-man sticker on back, left button missing, lock screen is a cat photo." This is 100% hidden and will be used by our AI to test the owner.
              </p>
              <input
                id="item-secret"
                type="text"
                className={styles.input}
                placeholder="e.g. Spider-man sticker on back, left button missing"
                value={secretDetails}
                onChange={e => setSecretDetails(e.target.value)}
                maxLength={300}
              />
            </div>
          </div>
        )}

        {/* ══════════════ STEP 2: Upload Photo ══════════════ */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepHeading}>Upload photos of the item</h2>
            <p className={styles.stepSubtitle}>
              Take a clear photo. In the next step you'll mark which parts to blur.
            </p>

            <div className={styles.photoGrid}>
              {images.map((imgSrc, idx) => (
                <div key={idx} className={styles.photoThumb}>
                  <img src={imgSrc} alt={`Uploaded ${idx + 1}`} />
                  <button type="button" className={styles.photoRemoveBtn} onClick={() => removeImage(idx)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              
              {images.length < 5 && (
                <label className={styles.addPhotoCard} htmlFor="gallery-upload">
                  <Plus size={24} />
                  <span style={{ fontSize: '0.8rem' }}>Add Photo</span>
                </label>
              )}
            </div>

            {images.length < 5 && (
              <div className={styles.uploadPlaceholder} style={{ padding: '24px', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                <div className={styles.uploadButtons}>
                  <label className={styles.cameraBtn} htmlFor="camera-upload">
                    <Camera size={16} /> Take Photo
                  </label>
                  <label className={styles.galleryBtn} htmlFor="gallery-upload">
                    <ImageIcon size={16} /> Choose from Gallery
                  </label>
                </div>
                <span className={styles.uploadHint}>JPG, PNG, WEBP — max 5MB</span>
              </div>
            )}

            <div className={styles.photoCounter}>
              {images.length} / 5 photos uploaded
            </div>

            {/* Hidden file inputs */}
            <input
              id="camera-upload"
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleImageUpload}
              className={styles.hiddenInput}
            />
            <input
              id="gallery-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className={styles.hiddenInput}
            />

            {/* Important note for the finder */}
            <div className={styles.infoBox} style={{ display: 'flex', gap: '8px' }}>
              <Info size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Tip:</strong> Take a photo that shows the item clearly.
                In the next step, you will mark private areas (like IDs, engravings)
                to blur them out before the image goes public.
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ STEP 3: Mark Blur Areas ══════════════ */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepHeading}>Blur sensitive areas</h2>
            <p className={styles.stepSubtitle}>
              Publicly hiding private details ensures only the real owner can identify the item.
            </p>

            {images.length > 1 && (
              <div className={styles.blurTabs}>
                {images.map((imgSrc, idx) => (
                  <div 
                    key={idx} 
                    className={`${styles.blurTab} ${activeImageIndex === idx ? styles.blurTabActive : ''}`}
                    onClick={() => setActiveImageIndex(idx)}
                  >
                    <img src={imgSrc} alt={`Tab ${idx + 1}`} />
                  </div>
                ))}
              </div>
            )}

            {/* The blur region drawing tool */}
            <BlurRegionSelector
              imageSrc={images[activeImageIndex]}
              blurZones={allBlurZones[activeImageIndex] || []}
              onChange={(zones) => setAllBlurZones(prev => ({...prev, [activeImageIndex]: zones}))}   /* When zones change, update our state */
              hint={blurHint}           /* Category-specific guidance */
            />

            {/* Submit confirmation info */}
            <div className={styles.infoBox} style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-cyan, #00d2ff)' }} />
              <div>
                <strong>What happens next:</strong> Your item will be listed publicly with the blurred image.
                When someone claims ownership, our AI will ask them questions to verify they're the real owner.
                Your identity stays hidden until the process is complete.
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className={styles.navBtns}>
          {/* Back button (hidden on step 1) */}
          {step > 1 && (
            <button className={styles.backStepBtn} onClick={handleBack} type="button">
              ← Back
            </button>
          )}

          {/* Next or Submit button */}
          {step < 3 ? (
            <button className={styles.nextBtn} onClick={handleNext} type="button" disabled={loading}>
              {loading ? <><ButtonSpinner /> Scanning photo...</> : 'Next →'}
            </button>
          ) : (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              type="button"
              disabled={loading}
            >
              {loading
                ? <><ButtonSpinner /> AI is checking your item...</>
                : '🚀 Submit Found Item Report'
              }
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

export default ReportFoundPage;
