/* ============================================================
   verificationUtils.js — AI Ownership Verification Logic
   
   This file now only handles storing claims in localStorage.
   The actual verification logic and dynamic question generation
   is handled entirely by Gemini AI in geminiService.js.
   ============================================================ */

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
