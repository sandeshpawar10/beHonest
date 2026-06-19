/* ============================================================
   verificationUtils.js — AI Ownership Verification Logic
   
   HOW IT WORKS (simple explanation):
   
   1. The claimant answers 5 questions about the item:
      - Brand/make
      - Color/appearance  
      - Unique marks (scratches, stickers, etc.)
      - Where they think they lost it (location)
      - When they think they lost it (date)
   
   2. We compare each answer to the item's stored data
      (title, description, location, category, foundAt date)
   
   3. Each question gets a score from 0 to 100 based on
      how well the answer matches.
   
   4. All scores are combined into a CONFIDENCE SCORE (0–100%).
   
   5. Based on the score, we give a VERDICT:
      - 80–100% → ✅ VERIFIED (high confidence, likely the real owner)
      - 50–79%  → 🔍 NEEDS REVIEW (moderate match, manual check needed)
      - 0–49%   → ❌ REJECTED (low confidence, probably not the owner)
   
   NOTE: This is a LOCAL simulation. In a real product, you'd
   send the answers to a backend with a real AI model (GPT, etc.)
   ============================================================ */

/* ----------------------------------------------------------
   VERIFICATION_QUESTIONS
   
   These are the 5 questions the AI asks the claimant.
   Each question has:
   - id       : unique key for the question
   - label    : the question text shown to the user
   - icon     : emoji for visual identification
   - placeholder: example answer text
   - weight   : how important this question is (out of 100 total)
                 Higher weight = more impact on the final score
   ---------------------------------------------------------- */
export const VERIFICATION_QUESTIONS = [
  {
    id: 'brand',
    label: 'What is the brand or make of this item?',
    icon: '🏷️',
    placeholder: 'e.g. Nike, Samsung, Ray-Ban, Wildcraft...',
    weight: 20,  // 20% of total score
  },
  {
    id: 'color',
    label: 'What is the primary colour / appearance?',
    icon: '🎨',
    placeholder: 'e.g. Dark blue with silver buckle, Black leather...',
    weight: 20,  // 20% of total score
  },
  {
    id: 'uniqueMarks',
    label: 'Any unique marks, scratches, stickers, or damage?',
    icon: '🔍',
    placeholder: 'e.g. Scratch on the back, Avengers sticker on top...',
    weight: 25,  // 25% — most important! Only real owner knows this
  },
  {
    id: 'lossLocation',
    label: 'Where do you think you lost it?',
    icon: '📍',
    placeholder: 'e.g. Near the library, cafeteria, parking lot B...',
    weight: 20,  // 20% of total score
  },
  {
    id: 'lossDate',
    label: 'When did you lose it? (approximate date)',
    icon: '📅',
    placeholder: 'e.g. Last Monday, 15th June, about a week ago...',
    weight: 15,  // 15% of total score
  },
];

/* ----------------------------------------------------------
   calculateWordMatchScore()
   
   The core matching function.
   
   Takes two strings and checks how many words from the
   claimant's answer also appear in the reference text.
   
   EXAMPLE:
     reference = "Found a blue Nike wallet near the library"
     answer    = "It's a Nike blue wallet"
     
     Common words: "blue", "nike", "wallet" → 3 out of 4 = 75%
   
   Returns a number from 0 to 100.
   ---------------------------------------------------------- */
function calculateWordMatchScore(referenceText, answerText) {
  // If either text is empty, score is 0
  if (!referenceText || !answerText) return 0;

  // Step 1: Convert both texts to lowercase and split into words
  //         Also remove common "stop words" that don't carry meaning
  const stopWords = [
    'the', 'a', 'an', 'is', 'it', 'its', 'was', 'has', 'had', 'with',
    'and', 'or', 'but', 'on', 'in', 'at', 'to', 'of', 'for', 'my',
    'i', 'this', 'that', 'there', 'near', 'from', 'about', 'have',
  ];

  // Clean a text string: lowercase → split by spaces → remove stop words
  const cleanWords = (text) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')  // Remove punctuation, keep letters/numbers
      .split(/\s+/)                    // Split by whitespace
      .filter(word => word.length > 1) // Remove single characters
      .filter(word => !stopWords.includes(word)); // Remove stop words
  };

  const referenceWords = cleanWords(referenceText);
  const answerWords    = cleanWords(answerText);

  // If the answer has no meaningful words, score is 0
  if (answerWords.length === 0) return 0;

  // Step 2: Count how many words from the ANSWER appear in the REFERENCE
  //         We use "fuzzy" matching — a word matches if one contains the other
  let matchCount = 0;

  answerWords.forEach(answerWord => {
    const hasMatch = referenceWords.some(refWord => {
      /*
        Fuzzy match: check if either word CONTAINS the other.
        This catches partial matches like:
          "lib" matches "library"
          "samsung" matches "samsung"
          "blue" matches "blue"
      */
      return refWord.includes(answerWord) || answerWord.includes(refWord);
    });
    if (hasMatch) matchCount++;
  });

  // Step 3: Calculate percentage of answer words that matched
  //         Score = (matched words / total answer words) × 100
  const score = (matchCount / answerWords.length) * 100;

  return Math.round(score); // Round to whole number
}

/* ----------------------------------------------------------
   calculateDateScore()
   
   Compares the date the item was FOUND vs when the claimant
   says they LOST it. Closer dates = higher score.
   
   Logic:
   - Same day or 1 day before    → 100 points
   - Within 3 days               → 80 points
   - Within 7 days               → 60 points
   - Within 14 days              → 40 points
   - More than 14 days           → 20 points
   - Can't parse the date        → 30 points (benefit of the doubt)
   ---------------------------------------------------------- */
function calculateDateScore(foundAtISOString, claimantDateText) {
  if (!claimantDateText || !claimantDateText.trim()) return 0;

  const foundDate = new Date(foundAtISOString);

  // Try to parse the claimant's text as a date
  // JavaScript's Date() can handle many formats like "June 15" or "2024-06-15"
  const claimDate = new Date(claimantDateText);

  // If the claimant's text can't be parsed as a valid date,
  // try to detect relative time words
  if (isNaN(claimDate.getTime())) {
    const lower = claimantDateText.toLowerCase();

    // Check for common relative time expressions
    if (lower.includes('today') || lower.includes('just now'))    return 90;
    if (lower.includes('yesterday'))                               return 85;
    if (lower.includes('last week') || lower.includes('few days')) return 60;
    if (lower.includes('last month'))                              return 30;

    // Can't understand the date at all — give moderate score
    return 30;
  }

  // Calculate the difference in days between found date and claimed loss date
  const diffMs   = Math.abs(foundDate.getTime() - claimDate.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24); // Convert ms to days

  // Score based on how close the dates are
  if (diffDays <= 1)  return 100;  // Same day or 1 day → perfect match
  if (diffDays <= 3)  return 80;   // Within 3 days → strong match
  if (diffDays <= 7)  return 60;   // Within a week → decent match
  if (diffDays <= 14) return 40;   // Within 2 weeks → weak match
  return 20;                        // More than 2 weeks → poor match
}

/* ----------------------------------------------------------
   calculateLocationScore()
   
   Compares where the item was FOUND vs where the claimant
   says they LOST it.
   
   This uses word matching but also checks for known
   campus location keywords to boost accuracy.
   ---------------------------------------------------------- */
function calculateLocationScore(foundLocation, claimedLocation) {
  if (!claimedLocation || !claimedLocation.trim()) return 0;

  // First, do basic word matching
  let score = calculateWordMatchScore(foundLocation, claimedLocation);

  // Boost: check if they mention the same type of campus location
  const locationKeywords = [
    'library', 'cafeteria', 'canteen', 'lab', 'class', 'classroom',
    'hall', 'parking', 'gym', 'ground', 'gate', 'hostel', 'mess',
    'auditorium', 'corridor', 'staircase', 'floor', 'building',
    'department', 'office', 'garden', 'ground', 'field', 'court'
  ];

  const foundLower   = foundLocation.toLowerCase();
  const claimedLower = claimedLocation.toLowerCase();

  // Check if both texts share a campus location keyword
  locationKeywords.forEach(keyword => {
    if (foundLower.includes(keyword) && claimedLower.includes(keyword)) {
      score = Math.min(100, score + 25); // Boost by 25 points (capped at 100)
    }
  });

  return Math.round(score);
}

/* ----------------------------------------------------------
   verifyOwnership()  ← THE MAIN FUNCTION
   
   Called when the claimant submits their answers.
   
   Parameters:
   - item     : the found item object (from itemUtils.js)
   - answers  : object with the claimant's answers, like:
                 { brand: "Nike", color: "Blue", ... }
   
   Returns:
   {
     overallScore: 72,          ← 0–100 confidence percentage
     verdict: "needs_review",   ← "verified" | "needs_review" | "rejected"
     verdictLabel: "🔍 Needs Review",
     verdictMessage: "Some answers match...",
     breakdown: [               ← score for each individual question
       { questionId: "brand", score: 85, maxScore: 20, earned: 17 },
       ...
     ]
   }
   ---------------------------------------------------------- */
export function verifyOwnership(item, answers) {

  /*
    referenceText is ALL the text data we have about the item,
    combined into one big string. The claimant's answers for
    brand, color, and uniqueMarks will be matched against this.
    
    We combine title + description + category so that if the
    finder mentioned "Nike" in the title but "blue" in the
    description, both can be matched.
  */
  const referenceText = [
    item.title       || '',
    item.description || '',
    item.category    || '',
  ].join(' ');

  // ── Score each question ────────────────────────────────────
  const breakdown = VERIFICATION_QUESTIONS.map(question => {

    const answer = (answers[question.id] || '').trim();
    let rawScore = 0; // 0–100 for this question

    // Choose the right scoring method based on question type
    switch (question.id) {

      case 'brand':
        // Match brand answer against the combined reference text
        rawScore = calculateWordMatchScore(referenceText, answer);
        break;

      case 'color':
        // Match color answer against the combined reference text
        rawScore = calculateWordMatchScore(referenceText, answer);
        break;

      case 'uniqueMarks':
        // Match unique marks against the description specifically
        // (description is where finders usually mention scratches, stickers, etc.)
        rawScore = calculateWordMatchScore(item.description || '', answer);
        break;

      case 'lossLocation':
        // Use the special location comparison function
        rawScore = calculateLocationScore(item.location || '', answer);
        break;

      case 'lossDate':
        // Use the special date comparison function
        rawScore = calculateDateScore(item.foundAt, answer);
        break;

      default:
        rawScore = 0;
    }

    /*
      Convert the raw score (0–100) to a WEIGHTED score.
      
      Example: if brand has weight 20 and rawScore is 75:
        earned = (75/100) × 20 = 15 out of 20 possible points
    */
    const earned = parseFloat(((rawScore / 100) * question.weight).toFixed(1));

    return {
      questionId: question.id,
      questionLabel: question.label,
      icon: question.icon,
      rawScore,                     // 0–100 (individual question score)
      maxScore: question.weight,    // Maximum possible weighted points
      earned,                       // Actual weighted points earned
    };
  });

  // ── Calculate overall score ────────────────────────────────
  // Sum all the earned weighted points
  // Total possible = sum of all weights = 100
  const overallScore = Math.round(
    breakdown.reduce((sum, item) => sum + item.earned, 0)
  );

  // ── Determine the verdict ──────────────────────────────────
  let verdict, verdictLabel, verdictMessage;

  if (overallScore >= 80) {
    verdict        = 'verified';
    verdictLabel   = '✅ Verified — High Confidence';
    verdictMessage = 'Your answers strongly match the item\'s details. You are very likely the owner. The finder will be notified to arrange the handover.';

  } else if (overallScore >= 50) {
    verdict        = 'needs_review';
    verdictLabel   = '🔍 Needs Review — Moderate Match';
    verdictMessage = 'Some of your answers match, but the confidence isn\'t high enough for automatic verification. A campus admin may review your claim, or you can provide additional proof.';

  } else {
    verdict        = 'rejected';
    verdictLabel   = '❌ Rejected — Low Confidence';
    verdictMessage = 'Your answers do not sufficiently match the item\'s recorded details. If you believe this is your item, please try again with more specific information.';
  }

  // ── Return the complete verification result ────────────────
  return {
    overallScore,      // 0–100
    verdict,           // "verified" | "needs_review" | "rejected"
    verdictLabel,      // Human-readable verdict with emoji
    verdictMessage,    // Longer explanation message
    breakdown,         // Per-question score details
    verifiedAt: new Date().toISOString(), // Timestamp of verification
  };
}

/* ----------------------------------------------------------
   CLAIMS STORAGE
   Save and load ownership claims in localStorage.
   Each claim links a claimant to an item + their verification result.
   ---------------------------------------------------------- */

const CLAIMS_KEY = 'bh_claims';

// Save a new claim record
export function saveClaim(claim) {
  const existing = getAllClaims();
  const newClaim = {
    ...claim,
    id: 'bh_claim_' + Date.now(),
    claimedAt: new Date().toISOString(),
  };
  existing.push(newClaim);
  localStorage.setItem(CLAIMS_KEY, JSON.stringify(existing));
  return newClaim;
}

// Get all claims
export function getAllClaims() {
  const raw = localStorage.getItem(CLAIMS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); }
  catch { return []; }
}

// Get all claims for a specific item
export function getClaimsForItem(itemId) {
  return getAllClaims().filter(c => c.itemId === itemId);
}
