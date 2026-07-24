/* ============================================================
   fraudUtils.js — Fraud Detection Engine (Hybrid)
   
   HOW IT WORKS (simple explanation):
   
   This file contains TWO types of checks:
   
   A) HEURISTIC CHECKS (instant, no API needed):
      - Upload frequency: Is this user uploading too many items?
      - Duplicate image: Was this exact image already uploaded?
      - Description quality: Is the description too short or generic?
      - Reward patterns: Is this user claiming suspicious amounts?
   
   B) GEMINI AI CHECKS (async, needs API key):
      - Is the image AI-generated?
      - Does the description match the image?
      - Is it a fake/stock photo?
   
   The function runFullFraudScan() runs ALL checks and returns
   a combined "fraud report" that gets saved to localStorage
   and displayed on the Fraud Dashboard.
   
   IMPORTANT: We FLAG suspicious activity but do NOT block it.
   The admin reviews flags on the dashboard and decides.
   ============================================================ */

import { getAllFoundItems } from './itemUtils';
import { getAllEscrows } from './rewardUtils';
import { analyzeImageForFraud } from './geminiService';
// Import from shared module (avoids circular dependency with itemUtils)
import { generateImageFingerprint } from './imageFingerprint';

// Re-export so other files that import from fraudUtils still work
export { generateImageFingerprint };



/* ==============================================================
   IMAGE FINGERPRINTING
   
   The actual function is in imageFingerprint.js (shared module).
   It's imported above and re-exported.
   
   See imageFingerprint.js for the full explanation of how it works.
   ============================================================== */


/* ==============================================================
   PART 2: HEURISTIC CHECKS (instant, no API)
   ============================================================== */

/* ----------------------------------------------------------
   Check 1: Upload Frequency
   
   Counts how many items this user uploaded in the last 24 hours.
   Normal users upload 1-2 items. If someone uploads 3+, it's
   suspicious — they might be spamming fake items.
   
   Returns: { flagged: true/false, type, severity, message, ... }
   ---------------------------------------------------------- */
export async function checkUploadFrequency(email) {
  try {
    const response = await fetch('http://localhost:8000/api/item/getAllFoundItems',{
      method: 'GET',
    })
    
    if (!response.ok) {
      console.warn("Could not fetch items for frequency check");
      return { flagged: false };
    }

    // Assuming the backend returns { status: "success", items: [...] } or just an array
    const data = await response.json();
    const items = data.items || data || [];

    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000; // 24h in milliseconds

    // Filter: items by this user, uploaded in the last 24 hours
    // (Ensure your backend schema matches 'reportedBy' or 'foundBy' and 'dateFound' or 'foundAt')
    const recentUploads = items.filter(item =>
      item.reportedBy === email &&
      (now - new Date(item.dateFound || item.foundAt).getTime()) < twentyFourHours
    );

    // 3+ uploads = suspicious, 5+ = very suspicious
    if (recentUploads.length >= 3) {
      return {
        flagged: true,
        type: 'HIGH_FREQUENCY',
        severity: recentUploads.length >= 5 ? 'high' : 'medium',
        message: `User uploaded ${recentUploads.length} items in the last 24 hours`,
        details: `Uploaded ${recentUploads.length} items recently. Normal users upload 1-2 items.`,
      };
    }

  } catch (error) {
    console.error("Error in checkUploadFrequency:", error);
  }

  return { flagged: false };
}


/* ----------------------------------------------------------
   Check 2: Duplicate Image Detection
   
   Compares the image fingerprint against all existing items.
   If two items have the same fingerprint → same image.
   
   Parameters:
   - fingerprint    : the hash of the new image
   - excludeItemId  : skip this item (so it doesn't match itself)
   ---------------------------------------------------------- */
export async function checkDuplicateImage(fingerprint, excludeItemId = null) {
  // No fingerprint or image too small → can't check
  if (!fingerprint || fingerprint === 'too_small') {
    return { flagged: false };
  }

  try {
    const response = await fetch('http://localhost:8000/api/item/getAllFoundItems',{
      method: 'GET',
    })
    
    if (!response.ok) {
      console.warn("Could not fetch items");
      return { flagged: false };
    }

    // Assuming the backend returns { status: "success", items: [...] } or just an array
    const data = await response.json();
    const items = data.items || data || [];

    const duplicate = items.find(item =>
      item.imageFingerprint === fingerprint &&
      item.id !== excludeItemId
    );

    if (duplicate) {
      return {
        flagged: true,
        type: 'DUPLICATE_IMAGE',
        severity: 'high',
        message: `Same image was already uploaded for "${duplicate.title}"`,
        details: `This image matches an existing item (${duplicate.id}). Possible re-upload or fraud attempt.`,
        duplicateItemId: duplicate.id,
        duplicateItemTitle: duplicate.title,
      };
    }

  } catch (error) {
    console.error("Error in checkDuplicateImage:", error);
  }

  return { flagged: false };
}


/* ----------------------------------------------------------
   Check 3: Description Quality
   
   Checks if the description is:
   - Too short (less than 10 characters)
   - Too generic (like "found item" or "test")
   
   Returns an ARRAY of flags (could have 0, 1, or 2 flags)
   ---------------------------------------------------------- */
export function checkDescriptionQuality(description, title) {
  const flags = [];

  // ── Check: Too short ──
  if (!description || description.trim().length < 10) {
    flags.push({
      flagged: true,
      type: 'LOW_QUALITY_DESCRIPTION',
      severity: 'medium',
      message: 'Description is very short (less than 10 characters)',
      details: 'Genuine item reports usually have detailed descriptions.',
    });
  }

  // ── Check: Generic / placeholder text ──
  const genericPhrases = [
    'found item', 'found this', 'pick up', 'come get it',
    'test', 'testing', 'asdf', 'xxx', 'aaa', 'hello',
    'item found', 'something', 'stuff',
  ];
  const lowerDesc = (description || '').toLowerCase().trim();

  for (const phrase of genericPhrases) {
    // Flag if the entire description IS the generic phrase,
    // or if it's very short and contains it
    if (lowerDesc === phrase || (lowerDesc.length < 20 && lowerDesc.includes(phrase))) {
      flags.push({
        flagged: true,
        type: 'GENERIC_DESCRIPTION',
        severity: 'low',
        message: `Description appears generic or placeholder: "${description}"`,
        details: 'The description lacks specific details about the item.',
      });
      break; // One generic flag is enough
    }
  }

  return flags;
}


/* ----------------------------------------------------------
   Check 4: Suspicious Reward Patterns
   
   Checks if a user has been claiming an unusually high
   number of items and receiving large rewards.
   
   5+ claims = suspicious (could be coordinated fraud)
   ---------------------------------------------------------- */
export function checkSuspiciousRewardPattern(email) {
  const escrows = getAllEscrows();

  // Count escrows where this user is the depositor (claimant)
  const userClaims = escrows.filter(e => e.depositorEmail === email);

  if (userClaims.length >= 5) {
    const totalReward = userClaims.reduce((sum, e) => sum + e.rewardAmount, 0);
    return {
      flagged: true,
      type: 'SUSPICIOUS_REWARD_PATTERN',
      severity: totalReward > 3000 ? 'high' : 'medium',
      message: `User has ${userClaims.length} claims totaling ₹${totalReward}`,
      details: 'Unusually high number of claims. Could indicate coordinated fraud.',
    };
  }

  return { flagged: false };
}


/* ==============================================================
   PART 3: FULL FRAUD SCAN
   
   This is the MAIN function. It runs ALL checks (heuristic + AI)
   and returns a complete fraud report.
   
   The flow:
   1. Run all 4 heuristic checks (instant)
   2. Send image to Gemini AI for analysis (async, 2-5 seconds)
   3. Combine all flags into one report
   4. Calculate overall risk level
   5. Save the report to localStorage
   6. Return the report
   ============================================================== */

export async function runFullFraudScan(item, email, options = {}) {
  // ── Initialize the report object ───────────────────────
  const report = {
    itemId: item.id || 'pending',
    itemTitle: item.title,
    scannedAt: new Date().toISOString(),
    scannedBy: email,
    heuristicFlags: [],    // Flags from instant checks
    aiFlags: [],           // Flags from Gemini AI
    aiAnalysis: null,      // Raw Gemini response
    overallRisk: 'clean',  // clean | low | medium | high
  };

  // ══════════ HEURISTIC CHECKS (instant) ══════════

  // 1. Upload frequency
  const freqCheck = await checkUploadFrequency(email);
  if (freqCheck.flagged) report.heuristicFlags.push(freqCheck);

  // 2. Duplicate image
  const fingerprint = generateImageFingerprint(item.imageData);
  const dupCheck = await checkDuplicateImage(fingerprint, item.id);
  if (dupCheck.flagged) report.heuristicFlags.push(dupCheck);

  // 3. Description quality
  const descFlags = checkDescriptionQuality(item.description, item.title);
  report.heuristicFlags.push(...descFlags);

  // 4. Reward patterns
  const rewardCheck = checkSuspiciousRewardPattern(email);
  if (rewardCheck.flagged) report.heuristicFlags.push(rewardCheck);

  // ══════════ GEMINI AI CHECKS (async) ══════════

  // Only run AI checks if:
  // - There's an image to analyze
  // - The caller didn't explicitly disable AI (options.runAI !== false)
  if (item.imageData && options.runAI !== false) {
    try {
      const aiResult = await analyzeImageForFraud(
        item.imageData,
        item.description || '',
        item.category || 'other'
      );

      // Save the raw Gemini response
      report.aiAnalysis = aiResult;

      // If Gemini responded successfully (not skipped, no error)
      if (!aiResult.skipped && !aiResult.error) {
        // Convert each AI finding into our standard flag format

        if (aiResult.isAIGenerated) {
          report.aiFlags.push({
            flagged: true,
            type: 'AI_GENERATED_IMAGE',
            severity: 'high',
            message: 'Gemini AI detected this image may be AI-generated',
            details: aiResult.reasoning || 'The image shows signs of AI generation.',
          });
        }

        if (aiResult.isFakeImage) {
          report.aiFlags.push({
            flagged: true,
            type: 'FAKE_IMAGE',
            severity: 'high',
            message: 'Gemini AI detected this may be a stock/fake image',
            details: aiResult.reasoning || 'The image appears to be from the internet.',
          });
        }

        if (aiResult.descriptionMismatch) {
          report.aiFlags.push({
            flagged: true,
            type: 'DESCRIPTION_MISMATCH',
            severity: 'medium',
            message: 'Image does not match the provided description',
            details: aiResult.reasoning || 'The image content doesn\'t match the description.',
          });
        }

        if (aiResult.suspiciousQuality) {
          report.aiFlags.push({
            flagged: true,
            type: 'SUSPICIOUS_QUALITY',
            severity: 'low',
            message: 'Image quality is suspicious (too blurry, too small, or screenshot)',
            details: aiResult.reasoning || 'The image quality raises concerns.',
          });
        }
      }
    } catch (err) {
      // AI check failed — store the error but don't crash
      report.aiAnalysis = { error: err.message, skipped: true };
    }
  }

  // ══════════ CALCULATE OVERALL RISK ══════════

  const allFlags = [...report.heuristicFlags, ...report.aiFlags];
  const highFlags = allFlags.filter(f => f.severity === 'high').length;
  const medFlags = allFlags.filter(f => f.severity === 'medium').length;

  if (highFlags >= 1) {
    report.overallRisk = 'high';
  } else if (medFlags >= 2 || allFlags.length >= 3) {
    report.overallRisk = 'medium';
  } else if (allFlags.length > 0) {
    report.overallRisk = 'low';
  } else {
    report.overallRisk = 'clean'; // No flags at all!
  }

  return report;
}
