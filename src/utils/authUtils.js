/* ============================================================
   authUtils.js — Core Authentication Utility Functions
   Used by AuthContext and all auth-related components
   All logic here is pure JS — no React dependencies
   ============================================================ */

// ── Configuration ──────────────────────────────────────────────
// Central config object — change settings here, they apply everywhere
export const AUTH_CONFIG = {

  // Accepted college email domain suffixes
  // Add your institution's domain to this list
  ALLOWED_DOMAINS: [
    '.edu',       // US colleges
    '.ac.in',     // Indian colleges/universities
    '.edu.in',    // Some Indian universities
    '.ac.uk',     // UK universities
    '.edu.au',    // Australian universities
    '.edu.pk',    // Pakistani universities
    '.ac.za',     // South African universities
    '.edu.sg',    // Singapore universities
  ],

  OTP_EXPIRY_MS:        5 * 60 * 1000,  // OTP valid for 5 minutes
  OTP_RESEND_COOLDOWN:  60,             // Seconds before user can resend OTP
  SESSION_EXPIRY_MS:    7 * 24 * 60 * 60 * 1000, // Session lasts 7 days
  MAX_LOGIN_ATTEMPTS:   5,              // Failed attempts before lockout
  LOCKOUT_DURATION_MS:  15 * 60 * 1000, // 15 minute lockout duration

  // localStorage key names
  KEYS: {
    USERS:   'bh_users',       // Registered users array
    SESSION: 'bh_session',     // Active session object
    PENDING: 'bh_pending_otp', // Pending OTP verification data
  }
};

// ── LocalStorage Helpers ───────────────────────────────────────

// Save any value to localStorage as JSON string
export function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// Get a value from localStorage and parse it back from JSON
export function lsGet(key) {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try { return JSON.parse(raw); }
  catch { return raw; }
}

// Remove a key from localStorage
export function lsRemove(key) {
  localStorage.removeItem(key);
}

// ── Email Validation ───────────────────────────────────────────

// Validate basic email format using regex (localPart@domain.tld)
export function isValidEmailFormat(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

// Check if email ends with an allowed college domain
export function isCollegeEmail(email) {
  const normalized = email.toLowerCase().trim();
  return AUTH_CONFIG.ALLOWED_DOMAINS.some(domain => normalized.endsWith(domain));
}

// Full college email validation — returns { valid, reason }
export function validateCollegeEmail(email) {
  const trimmed = email.trim();
  if (!trimmed)                        return { valid: false, reason: 'Email address is required.' };
  if (!isValidEmailFormat(trimmed))    return { valid: false, reason: 'Please enter a valid email address.' };
  if (!isCollegeEmail(trimmed))        return { valid: false, reason: 'Only college/university email addresses are allowed (.edu, .ac.in, etc.).' };
  return { valid: true, reason: '' };
}

// ── Password Validation 

// Evaluate password and return { valid, strength, reason }
// Strength levels: 'weak' | 'medium' | 'strong'
export function validatePassword(password) {
  if (!password || password.length < 8) {
    return { valid: false, strength: 'weak', reason: 'Password must be at least 8 characters.' };
  }
  // Count how many of the 4 character-type criteria are met
  const checks = [
    /[A-Z]/.test(password),     // Has uppercase
    /[a-z]/.test(password),     // Has lowercase
    /[0-9]/.test(password),     // Has number
    /[^A-Za-z0-9]/.test(password), // Has special char
  ].filter(Boolean).length;

  if (checks <= 2) return { valid: true, strength: 'weak',   reason: 'Weak: Add uppercase, numbers or symbols.' };
  if (checks === 3) return { valid: true, strength: 'medium', reason: 'Medium strength password.' };
  return                        { valid: true, strength: 'strong', reason: 'Strong password! 💪' };
}


// ── OTP Helpers ────────────────────────────────────────────────

// Generate a random N-digit numeric string
export function generateOTP(length = 6) {
  const min = Math.pow(10, length - 1); // e.g., 100000
  const max = Math.pow(10, length) - 1; // e.g., 999999
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

// Create an OTP, store it in localStorage, and return the code
// In production: call backend API to actually send the email
export function createAndStoreOTP(email) {
  const otp = generateOTP(6);
  lsSet(AUTH_CONFIG.KEYS.PENDING, {
    email,
    otp,
    expiresAt: Date.now() + AUTH_CONFIG.OTP_EXPIRY_MS, // 5 min from now
    attempts:  0,    // Wrong attempt counter
    createdAt: Date.now(),
  });
  // DEV MODE: log OTP to browser console (remove in production)
  console.log(`%c[beHonest DEV] OTP for ${email}: ${otp}`, 'color:#00d4ff;font-weight:bold;font-size:14px');
  return otp;
}

// Get the currently pending OTP data from localStorage
export function getPendingOTP() {
  return lsGet(AUTH_CONFIG.KEYS.PENDING);
}

// Verify submitted OTP — returns { success, reason }
export function verifyOTP(email, submittedOTP) {
  const pending = getPendingOTP();
  if (!pending)                                    return { success: false, reason: 'No OTP found. Please request a new one.' };
  if (pending.email.toLowerCase() !== email.toLowerCase()) return { success: false, reason: 'Email mismatch.' };
  if (Date.now() > pending.expiresAt) {
    lsRemove(AUTH_CONFIG.KEYS.PENDING);
    return { success: false, reason: 'OTP has expired. Please request a new one.' };
  }
  if (pending.attempts >= 3) {
    lsRemove(AUTH_CONFIG.KEYS.PENDING);
    return { success: false, reason: 'Too many failed attempts. Please request a new OTP.' };
  }
  if (pending.otp !== submittedOTP.trim()) {
    pending.attempts++;
    lsSet(AUTH_CONFIG.KEYS.PENDING, pending); // Save incremented counter
    const left = 3 - pending.attempts;
    return { success: false, reason: `Incorrect OTP. ${left} attempt${left !== 1 ? 's' : ''} remaining.` };
  }
  lsRemove(AUTH_CONFIG.KEYS.PENDING); // Clean up after successful verification
  return { success: true, reason: '' };
}

// ── Registration ───────────────────────────────────────────────

// Extract initials from a full name ("John Doe" → "JD")
export function getInitials(name) {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Capitalize first letter of each word ("john doe" → "John Doe")
export function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}



// Mask email for privacy display: "student@mit.edu" → "st***@mit.edu"
export function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const visible = Math.min(2, local.length);
  return `${local.slice(0, visible)}***@${domain}`;
}

// Format seconds as MM:SS countdown string
export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
