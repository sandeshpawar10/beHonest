/* ============================================================
   BlurRegionSelector.jsx
   
   PURPOSE:
   Let the finder DRAW rectangles on their uploaded image.
   Each drawn rectangle becomes a "blur zone" — a region
   that will be blurred on the public listing.
   
   HOW IT WORKS (simple explanation):
   1. User sees their uploaded image in a container
   2. They click and drag to draw a rectangle
   3. That rectangle is saved as { x, y, w, h } in % values
   4. A preview shows the image with all drawn blur zones
   5. They can delete any zone with the ✕ button

   PROPS:
   - imageSrc   : the uploaded image (base64 string)
   - blurZones  : current list of zones (state from parent)
   - onChange   : function called when zones list changes
   - hint       : instruction text to guide the user
   ============================================================ */

import { useState, useRef, useCallback } from 'react';
import BlurableImage from './BlurableImage';  // Reuse to show live preview
import styles from './BlurRegionSelector.module.css';

function BlurRegionSelector({ imageSrc, blurZones, onChange, hint }) {

  /*
    isDrawing: true when the user is holding mouse button down
    startPoint: where the mouse was when they first clicked { x, y }
    currentRect: the rectangle being drawn RIGHT NOW (live preview)
  */
  const [isDrawing, setIsDrawing]     = useState(false);
  const [startPoint, setStartPoint]   = useState(null);
  const [currentRect, setCurrentRect] = useState(null);

  // A ref to the image container div — needed to calculate % positions
  const containerRef = useRef(null);

  /*
    getPercentPosition()
    Converts a mouse event's pixel position to a percentage (0-100)
    relative to the image container.
    
    WHY percentages? Because the image can be displayed at any size,
    but the blur zones need to stay in the right place.
    Storing as % makes zones work at any screen size.
  */
  const getPercentPosition = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    // getBoundingClientRect() gives us the container's pixel position on screen

    // Calculate how far the mouse is from the container's top-left corner
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    // Convert to percentage of container size
    const percentX = (pixelX / rect.width)  * 100;
    const percentY = (pixelY / rect.height) * 100;

    // Clamp to 0–100 so we don't go outside the image
    return {
      x: Math.max(0, Math.min(100, percentX)),
      y: Math.max(0, Math.min(100, percentY))
    };
  }, []);

  /* ── Mouse Down: User starts drawing a rectangle ── */
  const handleMouseDown = (e) => {
    e.preventDefault(); // Prevents text selection while dragging
    const pos = getPercentPosition(e);
    setIsDrawing(true);
    setStartPoint(pos);   // Remember where the drag started
    setCurrentRect(null); // Clear any previous in-progress rect
  };

  /* ── Mouse Move: Update the live preview rectangle ── */
  const handleMouseMove = (e) => {
    if (!isDrawing || !startPoint) return; // Only update when dragging

    const pos = getPercentPosition(e);

    /*
      Calculate x, y (top-left corner) and w, h (size)
      from the start point and current mouse position.
      
      We use Math.min for x and y so that dragging in any
      direction (including up/left) still works correctly.
    */
    const x = Math.min(startPoint.x, pos.x);
    const y = Math.min(startPoint.y, pos.y);
    const w = Math.abs(pos.x - startPoint.x);
    const h = Math.abs(pos.y - startPoint.y);

    setCurrentRect({ x, y, w, h }); // Update the live preview
  };

  /* ── Mouse Up: Finish drawing, save the rectangle ── */
  const handleMouseUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    // Only save the rectangle if it's big enough to be meaningful
    // (ignore tiny accidental clicks — smaller than 3% in any direction)
    if (currentRect && currentRect.w > 3 && currentRect.h > 3) {
      // Round all values to 1 decimal place for cleaner storage
      const newZone = {
        x: parseFloat(currentRect.x.toFixed(1)),
        y: parseFloat(currentRect.y.toFixed(1)),
        w: parseFloat(currentRect.w.toFixed(1)),
        h: parseFloat(currentRect.h.toFixed(1))
      };

      // Tell the parent component about the new list of zones
      // (parent stores the state, we just call onChange)
      onChange([...blurZones, newZone]);
    }

    setCurrentRect(null); // Clear the in-progress rectangle
    setStartPoint(null);
  };

  /* ── Delete a blur zone by its index ── */
  const deleteZone = (indexToDelete) => {
    // Filter out the zone at the given index and pass the new list up
    const updated = blurZones.filter((_, index) => index !== indexToDelete);
    onChange(updated);
  };

  /* ── Clear ALL blur zones ── */
  const clearAll = () => {
    onChange([]); // Pass an empty array to parent
  };

  return (
    <div className={styles.container}>

      {/* Section heading */}
      <div className={styles.header}>
        <h3 className={styles.title}>✏️ Mark Sensitive Areas to Blur</h3>
        {/* Hint text tells the finder WHAT they should be hiding */}
        <p className={styles.hint}>{hint || 'Click and drag on the image to select areas to blur.'}</p>
      </div>

      {/* ── Two-column layout: Left = draw | Right = preview ── */}
      <div className={styles.columns}>

        {/* ── LEFT: Drawing Canvas ── */}
        <div className={styles.column}>
          <p className={styles.colLabel}>👇 Drag to mark areas</p>

          {/*
            The image container.
            User draws blur zones on this.
            Mouse events handle the drawing interaction.
          */}
          <div
            ref={containerRef}
            className={styles.drawArea}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp} // Cancel if mouse leaves the image
          >
            {/* The uploaded image */}
            <img src={imageSrc} alt="Uploaded item" className={styles.drawImage} />

            {/*
              Show already-saved blur zones as solid rectangles.
              These are shown while drawing so the user knows
              where zones already exist.
            */}
            {blurZones.map((zone, i) => (
              <div
                key={i}
                className={styles.savedZone}
                style={{
                  left:   zone.x + '%',
                  top:    zone.y + '%',
                  width:  zone.w + '%',
                  height: zone.h + '%'
                }}
              >
                {/* Delete button for this zone */}
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => {
                    e.stopPropagation(); // Don't start a new rectangle
                    deleteZone(i);
                  }}
                  title="Remove this blur zone"
                >
                  ✕
                </button>
              </div>
            ))}

            {/*
              Show the rectangle the user is CURRENTLY drawing.
              This is the live preview while they're still dragging.
            */}
            {currentRect && (
              <div
                className={styles.activeZone}
                style={{
                  left:   currentRect.x + '%',
                  top:    currentRect.y + '%',
                  width:  currentRect.w + '%',
                  height: currentRect.h + '%'
                }}
              />
            )}

            {/* Instruction shown in the centre when no zones exist yet */}
            {blurZones.length === 0 && !isDrawing && (
              <div className={styles.placeholder}>
                <span>🖱️ Click &amp; drag to blur a region</span>
              </div>
            )}
          </div>

          {/* Zone count + Clear All button */}
          <div className={styles.zoneInfo}>
            <span className={styles.zoneCount}>
              {blurZones.length === 0
                ? 'No blur zones added yet'
                : `${blurZones.length} blur zone${blurZones.length > 1 ? 's' : ''} added`
              }
            </span>
            {blurZones.length > 0 && (
              <button
                className={styles.clearBtn}
                onClick={clearAll}
                type="button"
              >
                🗑️ Clear All
              </button>
            )}
          </div>
        </div>

        {/* ── RIGHT: Live Blur Preview ── */}
        <div className={styles.column}>
          <p className={styles.colLabel}>👁️ Public view preview</p>
          <p className={styles.previewNote}>
            This is exactly how the public will see your image.
          </p>

          {/*
            Reuse the BlurableImage component to show the preview.
            This is the SAME component used on the public listing page.
          */}
          <BlurableImage
            imageSrc={imageSrc}
            blurZones={blurZones}
            alt="Preview of blurred image"
            blurStrength={14}
          />

          {/* Warning if no zones have been added */}
          {blurZones.length === 0 && (
            <div className={styles.noBlurWarning}>
              ⚠️ No areas blurred — the full image will be public.
              Add blur zones to protect sensitive details.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default BlurRegionSelector;
