/* ============================================================
   ReportFoundPage.jsx
   Route: /report-found  (protected — must be logged in)

   PURPOSE:
   A form where a college student who FOUND an item can:
   1. Select the item category (wallet, watch, phone, etc.)
   2. Write a title and description
   3. Upload a photo of the item
   4. Use BlurRegionSelector to mark sensitive areas to hide
   5. Submit → the server permanently redacts photos before publication
   ============================================================ */

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PackageOpen, Camera, ImageIcon, Info, CheckCircle, EyeOff, MapPin, ArrowLeft, Trash2, Plus } from 'lucide-react';
import BlurRegionSelector from '../components/ui/BlurRegionSelector';
import { CATEGORY_CONFIG } from '../utils/itemUtils';

import { generateImageFingerprint } from '../utils/imageFingerprint';
import { compressImage } from '../utils/imageCompressor';
import { FOUND_IMAGE_TYPES, MAX_FOUND_IMAGES, MAX_ORIGINAL_IMAGE_BYTES, processedImageError, redactionZonesError, foundImagesError } from '../utils/foundImagePrivacy';
import ButtonSpinner from '../components/ui/ButtonSpinner';
import styles from './ReportFoundPage.module.css';

function ReportFoundPage() {
  const navigate = useNavigate();
   // Get logged-in user info

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
  const [activeImageIndex, setActiveImageIndex] = useState(0); // which image is being redacted

  /* ── UI state ─────────────────────────────────────────── */
  const [step,    setStep]    = useState(1);     // Current step: 1=Details, 2=Photo, 3=Redact
  const [loading, setLoading] = useState(false); // Submit loading spinner
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const processingRef = useRef(false);
  const submittingRef = useRef(false);
  const [error,   setError]   = useState('');    // Validation error message
  const [isSuccess, setIsSuccess] = useState(false); // Success state

  /* ──────────────────────────────────────────────────────────
     handleImageUpload()
     Called when the user selects a file from their device.
     Processes a complete batch before allowing navigation or submission.
  */
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    // Reset input early so the user can re-capture if needed
    e.target.value = '';
    if (!files.length || processingRef.current || submittingRef.current) return;

    if (images.length + files.length > MAX_FOUND_IMAGES) {
      setError(`You can upload at most ${MAX_FOUND_IMAGES} photos. Choose ${MAX_FOUND_IMAGES - images.length} or fewer, or remove an existing photo.`);
      return;
    }
    for (const file of files) {
      if (!FOUND_IMAGE_TYPES.includes(file.type)) {
        setError(`${file.name}: Please choose a JPEG, PNG, or WebP photo.`);
        return;
      }
      if (file.size === 0 || file.size > MAX_ORIGINAL_IMAGE_BYTES) {
        setError(`${file.name}: Choose a non-empty photo no larger than 20 MiB before processing.`);
        return;
      }
    }

    processingRef.current = true;
    setProcessingPhotos(true);
    setError('');
    try {
      const processed = [];
      for (const file of files) {
        try {
          const image = await compressImage(file, 1600, 0.8);
          const validationError = processedImageError(image);
          if (validationError) throw new Error(validationError);
          processed.push(image);
        } catch (err) {
          throw new Error(`${file.name}: ${err.message || 'Failed to process photo. Please choose another photo.'}`, { cause: err });
        }
      }
      setImages(prev => [...prev, ...processed]);
    } catch (err) {
      setError(`No photos from this selection were added. ${err.message}`);
    } finally {
      processingRef.current = false;
      setProcessingPhotos(false);
    }
  };

  const removeImage = (indexToRemove) => {
    if (processingRef.current || submittingRef.current) return;
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
    setActiveImageIndex(index => Math.max(0, index > indexToRemove ? index - 1 : Math.min(index, images.length - 2)));
  };

  const updateZones = (zones) => {
    if (submittingRef.current) return;
    const validationError = redactionZonesError(zones);
    if (validationError) return setError(validationError);
    setError('');
    setAllBlurZones(prev => ({ ...prev, [activeImageIndex]: zones }));
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
      const validationError = foundImagesError(images, allBlurZones);
      if (validationError) return setError(validationError), false;
    }

    return true; // All good
  };

  /* ──────────────────────────────────────────────────────────
     handleNext() / handleBack()
     Move between the 3 steps of the form.
  */
  const handleNext = () => {
    if (processingRef.current || submittingRef.current) return;
    if (validateStep()) {
      setStep(s => s + 1); // Go to next step
      window.scrollTo(0, 0); // Scroll to top
    }
  };

  const handleBack = () => {
    if (processingRef.current || submittingRef.current) return;
    setStep(s => s - 1);
    setError('');
  };

  /* ──────────────────────────────────────────────────────────
     handleSubmit()
     Save the item when the user clicks "Submit" on step 3.
     The server validates the photos and permanently redacts marked areas.
  */
  const handleSubmit = async () => {
    if (processingRef.current || submittingRef.current) return;
    if (!category || !title.trim() || !description.trim() || !location.trim()) {
      setError('Please complete the required item details before submitting.');
      setStep(1);
      return;
    }
    const validationError = foundImagesError(images, allBlurZones);
    if (validationError) return setError(validationError);
    submittingRef.current = true;
    setLoading(true);
    setError('');

    try {
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
          // Originals are sent only for server-side processing, never public display.
          images: images, 
          imageFingerprint: generateImageFingerprint(images[0]),
          allBlurZones: Object.fromEntries(images.map((_, index) => [index, allBlurZones[index] || []]))
        }) 
      });

      const data = await response.json();
      
      if (response.ok) {
        setIsSuccess(true);
      } else {
        let errorMsg = data.error || data.message || "An error occurred";
        setError(errorMsg);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while communicating with the server. Please try again.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  /* ── Helper: get the blur hint for selected category ── */
  const blurHint = category
    ? CATEGORY_CONFIG[category]?.blurHint?.replace(/^Blur:/, 'Hide:')
    : 'Select a category first to get specific guidance on what to hide.';

  /* ── Render ──────────────────────────────────────────────── */
  if (isSuccess) {
    return (
      <div className={styles.page}>
        <div className={styles.card} style={{ textAlign: 'center', padding: '40px' }}>
          <CheckCircle size={64} style={{ color: 'var(--accent-cyan, #00d2ff)', margin: '0 auto 20px' }} />
          <h2>Item Submitted Successfully!</h2>
          <p style={{ margin: '20px 0', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Your item report has been sent to our admin team for manual review to ensure it meets our security guidelines. 
            You will receive an email notification once it is approved and listed on the platform.
          </p>
          <button className={styles.submitBtn} onClick={() => navigate('/found-items')}>
            Return to Found Items
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>

      {/* ── Top bar with back button ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate('/dashboard')} disabled={loading || processingPhotos}>
          <ArrowLeft size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Back to Dashboard
        </button>
        <h1 className={styles.pageTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PackageOpen size={24} /> Report Found Item
        </h1>
      </div>

      {/* ── Step progress indicator ── */}
      <div className={styles.steps}>
        {['Item Details', 'Upload Photo', 'Hide Private Areas'].map((label, i) => (
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
          <div className={styles.errorAlert} role="alert">
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
              Take a clear photo. In the next step you'll mark which parts to hide.
            </p>

            <div className={styles.photoGrid}>
              {images.map((imgSrc, idx) => (
                <div key={idx} className={styles.photoThumb}>
                  <img src={imgSrc} alt={`Uploaded ${idx + 1}`} />
                  <button type="button" className={styles.photoRemoveBtn} onClick={() => removeImage(idx)} disabled={processingPhotos || loading} aria-label={`Remove photo ${idx + 1}`}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              
              {images.length < MAX_FOUND_IMAGES && (
                <label className={styles.addPhotoCard} htmlFor="gallery-upload">
                  <Plus size={24} />
                  <span style={{ fontSize: '0.8rem' }}>Add Photo</span>
                </label>
              )}
            </div>

            {images.length < MAX_FOUND_IMAGES && (
              <div className={styles.uploadPlaceholder} style={{ padding: '24px', border: '2px dashed var(--border)', borderRadius: '16px' }}>
                <div className={styles.uploadButtons}>
                  <label className={styles.cameraBtn} htmlFor="camera-upload">
                    <Camera size={16} /> Take Photo
                  </label>
                  <label className={styles.galleryBtn} htmlFor="gallery-upload">
                    <ImageIcon size={16} /> Choose from Gallery
                  </label>
                </div>
                <span className={styles.uploadHint}>JPEG, PNG, WebP — up to 5 photos; 20 MiB each before processing, 5 MiB each after processing</span>
              </div>
            )}

            <div className={styles.photoCounter} role="status">
              {processingPhotos ? <><ButtonSpinner /> Processing photos...</> : `${images.length} / ${MAX_FOUND_IMAGES} photos ready`}
            </div>

            {/* Hidden file inputs */}
            <input
              id="camera-upload"
              type="file"
              accept={FOUND_IMAGE_TYPES.join(',')}
              disabled={processingPhotos || loading}
              capture="environment"
              onChange={handleImageUpload}
              className={styles.hiddenInput}
            />
            <input
              id="gallery-upload"
              type="file"
              accept={FOUND_IMAGE_TYPES.join(',')}
              disabled={processingPhotos || loading}
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
                for the server to permanently redact before the image goes public.
              </div>
            </div>
          </div>
        )}

        {/* ══════════════ STEP 3: Hide Private Areas ══════════════ */}
        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepHeading}>Hide sensitive areas</h2>
            <p className={styles.stepSubtitle}>
              Publicly hiding private details ensures only the real owner can identify the item.
            </p>

            {images.length > 1 && (
              <div className={styles.blurTabs}>
                {images.map((imgSrc, idx) => (
                  <button
                    key={idx} 
                    type="button"
                    disabled={loading}
                    aria-label={`Edit hidden areas for photo ${idx + 1}`}
                    className={`${styles.blurTab} ${activeImageIndex === idx ? styles.blurTabActive : ''}`}
                    onClick={() => setActiveImageIndex(idx)}
                  >
                    <img src={imgSrc} alt={`Tab ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}

            {/* Local redaction preview; public assets are produced by the server. */}
            <BlurRegionSelector
              key={activeImageIndex}
              imageSrc={images[activeImageIndex]}
              blurZones={allBlurZones[activeImageIndex] || []}
              onChange={updateZones}
              disabled={loading}
              hint={blurHint}           /* Category-specific guidance */
            />

            {/* Submit confirmation info */}
            <div className={styles.infoBox} style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <CheckCircle size={20} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--accent-cyan, #00d2ff)' }} />
              <div>
                <strong>What happens next:</strong> Your item will be submitted to the admin team for manual review. 
                The server permanently redacts the marked areas before the photos can be listed publicly.
                When someone claims ownership, admins will manually verify them.
                Your identity stays hidden until the process is complete.
              </div>
            </div>
          </div>
        )}

        {/* ── Navigation buttons ── */}
        <div className={styles.navBtns}>
          {/* Back button (hidden on step 1) */}
          {step > 1 && (
            <button className={styles.backStepBtn} onClick={handleBack} type="button" disabled={loading || processingPhotos}>
              ← Back
            </button>
          )}

          {/* Next or Submit button */}
          {step < 3 ? (
            <button className={styles.nextBtn} onClick={handleNext} type="button" disabled={loading || processingPhotos}>
              {processingPhotos ? <><ButtonSpinner /> Processing photos...</> : 'Next →'}
            </button>
          ) : (
            <button
              className={styles.submitBtn}
              onClick={handleSubmit}
              type="button"
              disabled={loading || processingPhotos}
            >
              {loading
                ? <><ButtonSpinner /> Submitting Report...</>
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
