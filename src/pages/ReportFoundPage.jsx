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
import BlurRegionSelector from '../components/ui/BlurRegionSelector';
import { saveFoundItem, CATEGORY_CONFIG } from '../utils/itemUtils';
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
  const [location,    setLocation]    = useState('');       // where it was found
  const [imageData,   setImageData]   = useState(null);     // base64 image string
  const [blurZones,   setBlurZones]   = useState([]);       // list of blur rectangles

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
    const file = e.target.files[0]; // Get the selected file
    if (!file) return;

    // Only allow image files
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }

    // Max file size: 5MB (5 * 1024 * 1024 bytes)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.');
      return;
    }

    setError('');

    /*
      FileReader reads the file from the user's device.
      readAsDataURL() converts it to a base64 string like:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
      This string can be used directly as an <img src="...">
    */
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageData(event.target.result); // Save the base64 string
      setBlurZones([]); // Reset blur zones when a new image is uploaded
    };
    reader.readAsDataURL(file);
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
      if (!imageData) return setError('Please upload a photo of the item.'), false;
    }

    return true; // All good
  };

  /* ──────────────────────────────────────────────────────────
     handleNext() / handleBack()
     Move between the 3 steps of the form.
  */
  const handleNext = () => {
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
  */
  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    // Small delay to show loading state (simulates a real API call)
    await new Promise(r => setTimeout(r, 800));

    // Save the item using our utility function
    saveFoundItem({
      category,
      title:       title.trim(),
      description: description.trim(),
      location:    location.trim(),
      imageData,        // The full base64 image
      blurZones,        // The blur rectangle list
      foundBy:     session.email,    // Finder's email (hidden publicly)
      foundByName: session.fullName, // Finder's name (hidden publicly)
    });

    setLoading(false);

    // Go to the public listing page to see the result
    navigate('/found-items');
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
          ← Back to Dashboard
        </button>
        <h1 className={styles.pageTitle}>📦 Report Found Item</h1>
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
                Describe what you can see — but DON'T mention specific identifying details
                (brand, serial numbers, engravings). Those will be used to verify the real owner.
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

            {/* Location */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="item-location">
                Where did you find it? *
              </label>
              <input
                id="item-location"
                type="text"
                className={styles.input}
                placeholder='e.g. "Library 2nd floor, near the study tables"'
                value={location}
                onChange={e => setLocation(e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
        )}

        {/* ══════════════ STEP 2: Upload Photo ══════════════ */}
        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepHeading}>Upload a photo of the item</h2>
            <p className={styles.stepSubtitle}>
              Take a clear photo. In the next step you'll mark which parts to blur.
            </p>

            {/* Drag-to-upload area */}
            <label className={styles.uploadArea} htmlFor="image-upload">
              {imageData ? (
                /* Show uploaded image preview */
                <div className={styles.uploadPreview}>
                  <img src={imageData} alt="Uploaded item" className={styles.previewImg} />
                  <span className={styles.changePhotoText}>Click to change photo</span>
                </div>
              ) : (
                /* Upload placeholder */
                <div className={styles.uploadPlaceholder}>
                  <span className={styles.uploadIcon}>📷</span>
                  <span className={styles.uploadText}>Click to upload a photo</span>
                  <span className={styles.uploadHint}>JPG, PNG, WEBP — max 5MB</span>
                </div>
              )}
            </label>

            {/* Hidden file input — triggered by clicking the label above */}
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className={styles.hiddenInput}
            />

            {/* Important note for the finder */}
            <div className={styles.infoBox}>
              <strong>📌 Tip:</strong> Take a photo that shows the item clearly.
              In the next step, you will mark private areas (like IDs, engravings)
              to blur them out before the image goes public.
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

            {/* The blur region drawing tool */}
            <BlurRegionSelector
              imageSrc={imageData}
              blurZones={blurZones}
              onChange={setBlurZones}   /* When zones change, update our state */
              hint={blurHint}           /* Category-specific guidance */
            />

            {/* Submit confirmation info */}
            <div className={styles.infoBox} style={{ marginTop: '16px' }}>
              <strong>✅ What happens next:</strong> Your item will be listed publicly with the blurred image.
              When someone claims ownership, our AI will ask them questions to verify they're the real owner.
              Your identity stays hidden until the process is complete.
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
            <button className={styles.nextBtn} onClick={handleNext} type="button">
              Next →
            </button>
          ) : (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              type="button"
              disabled={loading}
            >
              {loading
                ? <><span className={styles.spinner} /> Submitting...</>
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
