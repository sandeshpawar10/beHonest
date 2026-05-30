/* ============================================================
   VerifyOTPPage.jsx — OTP Verification Page Component
   Route: /verify-otp?email=...&context=register
   Features: 6-box digit input, auto-advance, paste support,
             countdown timer, resend with cooldown,
             registration completion after success
   ============================================================ */

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  maskEmail,        // Masks email for privacy display
  formatCountdown,  // Formats seconds as MM:SS
  AUTH_CONFIG,      // Config constants (cooldown, expiry)
} from '../utils/authUtils';
import styles from './VerifyOTPPage.module.css';

// Total OTP expiry in seconds (must match AUTH_CONFIG.OTP_EXPIRY_MS)
const OTP_TOTAL_SECONDS = 5 * 60; // 5 minutes

function VerifyOTPPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Read URL query params

  // Get email and context from URL (?email=...&context=register)
  const email   = searchParams.get('email')   || '';
  const context = searchParams.get('context') || 'register';

  const { confirmOTP, register, sendOTP } = useAuth();

  // ── OTP input state ───────────────────────────────────────
  // Array of 6 strings — one digit per box
  const [digits, setDigits] = useState(['', '', '', '', '', '']);

  // ── UI state ──────────────────────────────────────────────
  const [loading,    setLoading]    = useState(false);
  const [alert,      setAlert]      = useState({ msg: '', type: '' });
  const [boxState,   setBoxState]   = useState(''); // '' | 'error' | 'verified'

  // ── Countdown timer state ─────────────────────────────────
  const [timeLeft,       setTimeLeft]       = useState(OTP_TOTAL_SECONDS); // Seconds remaining
  const [resendCooldown, setResendCooldown] = useState(AUTH_CONFIG.OTP_RESEND_COOLDOWN);
  const [canResend,      setCanResend]      = useState(false); // Unlocks after cooldown

  // Refs for each OTP input box (for programmatic focus control)
  const inputRefs = useRef([]);

  // ── Redirect if no email in URL ──────────────────────────
  useEffect(() => {
    if (!email) navigate('/register'); // Can't verify without email
  }, [email, navigate]);

  // ── Auto-focus first box on mount ────────────────────────
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  // ── Countdown timer: ticks every 1 second ────────────────
  useEffect(() => {
    const interval = setInterval(() => {

      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval); // Stop when time hits 0
          return 0;
        }
        return prev - 1; // Decrease by 1 second
      });

      setResendCooldown(prev => {
        if (prev <= 1) {
          setCanResend(true); // Enable resend button when cooldown expires
          return 0;
        }
        return prev - 1;
      });

    }, 1000); // Run every 1000ms

    return () => clearInterval(interval); // Cleanup on unmount
  }, []); // Only runs once on mount — restart via resetTimer()

  // ── Input change handler for each OTP box ────────────────
  const handleDigitChange = (index, value) => {
    // Only accept single digit (strip non-numeric characters)
    const digit = value.replace(/[^0-9]/g, '').slice(-1); // Keep last char only

    // Update the digits array immutably
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    setAlert({ msg: '', type: '' }); // Clear any error on input

    // Auto-advance: move focus to next box when a digit is entered
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ── Keydown handler: backspace navigation ─────────────────
  const handleKeyDown = (index, e) => {

    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Current box is empty — go to previous box and clear it
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus(); // Move focus back
      }
    }

    if (e.key === 'ArrowLeft'  && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  // ── Paste handler: distribute pasted OTP across all boxes ─
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text')
      .replace(/[^0-9]/g, '') // Keep only digits
      .slice(0, 6);           // Max 6 digits

    if (pasted.length > 0) {
      // Fill boxes with pasted digits
      const newDigits = ['', '', '', '', '', ''];
      pasted.split('').forEach((d, i) => { newDigits[i] = d; });
      setDigits(newDigits);
      // Focus the last filled box
      const lastIdx = Math.min(pasted.length, 5);
      inputRefs.current[lastIdx]?.focus();
    }
  };

  // ── Verify button click ───────────────────────────────────
  const handleVerify = async () => {
    const otpString = digits.join(''); // Combine 6 digits into one string

    // All 6 boxes must be filled
    if (otpString.length < 6) {
      setAlert({ msg: 'Please enter the complete 6-digit OTP.', type: 'warning' });
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // Simulated verify delay

    // Call confirmOTP from AuthContext (which calls verifyOTP utility)
    const result = confirmOTP(email, otpString);

    if (!result.success) {
      // Wrong OTP — flash red on boxes
      setBoxState('error');
      setTimeout(() => setBoxState(''), 1000); // Remove error state after 1s
      setAlert({ msg: result.reason, type: 'error' });
      setLoading(false);
      return;
    }

    // ✅ OTP Verified — show success state on boxes
    setBoxState('verified');

    if (context === 'register') {
      // Retrieve pending registration data from sessionStorage
      const pendingRaw = sessionStorage.getItem('bh_reg_pending');
      if (!pendingRaw) {
        setAlert({ msg: 'Registration data not found. Please start over.', type: 'error' });
        setTimeout(() => navigate('/register'), 2000);
        return;
      }

      const pending = JSON.parse(pendingRaw);
      sessionStorage.removeItem('bh_reg_pending'); // Clean up immediately

      // Complete registration (creates user + auto-login via AuthContext)
      const regResult = register(pending.fullName, pending.email, pending.password);

      if (!regResult.success) {
        setAlert({ msg: regResult.reason, type: 'error' });
        setLoading(false);
        return;
      }

      // Show success briefly then navigate to dashboard
      setAlert({ msg: '🎉 Account created! Redirecting to dashboard...', type: 'success' });
      await new Promise(r => setTimeout(r, 1500));
      navigate('/dashboard', { replace: true });

    } else {
      // Future contexts (e.g., password reset)
      navigate('/dashboard', { replace: true });
    }
  };

  // ── Resend OTP ────────────────────────────────────────────
  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false); // Disable immediately (anti-spam)
    setDigits(['', '', '', '', '', '']); // Clear all boxes
    setBoxState('');
    setAlert({ msg: '', type: '' });

    await new Promise(r => setTimeout(r, 800));
    sendOTP(email); // Generate and store new OTP

    // Reset the cooldown and timer
    setResendCooldown(AUTH_CONFIG.OTP_RESEND_COOLDOWN);
    setTimeLeft(OTP_TOTAL_SECONDS);

    setAlert({ msg: 'New OTP sent! Check your email (Dev: see browser console).', type: 'success' });

    // Focus first box again
    inputRefs.current[0]?.focus();

    // Restart resend cooldown countdown
    const cooldownInterval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(cooldownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.card}>

        {/* Logo */}
        <img src="/logo.png" alt="beHonest" className={styles.logo} />

        {/* Step indicator: Register → Verify → Done */}
        <div className={styles.steps} role="progressbar" aria-label="Step 2 of 3">
          <span className={`${styles.dot} ${styles.done}`} title="Step 1: Register" />
          <span className={`${styles.dot} ${styles.active}`} title="Step 2: Verify Email" />
          <span className={styles.dot} title="Step 3: Dashboard" />
        </div>
        <p className={styles.stepLabel}>Step 2 of 3 — Email Verification</p>

        {/* Heading */}
        <h1 className={styles.heading}>Check your inbox 📬</h1>
        <p className={styles.subtitle}>
          We sent a 6-digit OTP to your college email. Enter it below to verify your identity.
        </p>

        {/* Masked email display */}
        <div className={styles.emailPreview}>
          <span>✉️</span>
          <span>OTP sent to: </span>
          <span className={styles.emailText} id="otp-email-display">
            {maskEmail(email)}
          </span>
        </div>

        {/* Alert */}
        {alert.msg && (
          <div
            className={`${styles.alert} ${styles[`alert_${alert.type}`]}`}
            role="alert"
            aria-live="polite"
          >
            <span>
              {alert.type === 'success' ? '✅' : alert.type === 'warning' ? '🔔' : '⚠️'}
            </span>
            {alert.msg}
          </div>
        )}

        {/* ── 6 OTP digit input boxes ── */}
        <div className={styles.otpRow} role="group" aria-label="Enter 6-digit OTP">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={el => (inputRefs.current[i] = el)} /* Store ref for focus control */
              type="tel"           /* Shows numeric keyboard on mobile */
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleDigitChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onPaste={handlePaste}  /* Only triggers on first box but handles all */
              onFocus={e => e.target.select()} /* Select existing digit on focus */
              className={[
                styles.otpBox,
                digit ? styles.filled : '',          // Styled when has a digit
                boxState === 'error'    ? styles.otpError    : '',
                boxState === 'verified' ? styles.otpVerified : '',
              ].filter(Boolean).join(' ')}
              aria-label={`OTP digit ${i + 1}`}
              id={`otp-digit-${i + 1}`}
            />
          ))}
        </div>

        {/* Countdown timer */}
        <div className={styles.timer} role="timer" aria-live="polite">
          OTP expires in{' '}
          <span className={`${styles.timerCount} ${timeLeft <= 60 ? styles.urgent : ''}`}>
            {formatCountdown(timeLeft)}
          </span>
        </div>

        {/* Verify button */}
        <button
          id="verify-otp-btn"
          className={styles.verifyBtn}
          onClick={handleVerify}
          disabled={loading || digits.join('').length < 6}
        >
          {loading
            ? <><span className={styles.spinner}></span> Verifying...</>
            : 'Verify OTP ✓'
          }
        </button>

        {/* Resend OTP */}
        <div className={styles.resendRow}>
          <span>Didn't receive it? </span>
          <button
            id="resend-otp-btn"
            className={`${styles.resendBtn} ${canResend ? styles.resendActive : ''}`}
            onClick={handleResend}
            disabled={!canResend}
            aria-label={canResend ? 'Resend OTP' : `Resend available in ${resendCooldown}s`}
          >
            {canResend ? 'Resend OTP' : `Resend in ${resendCooldown}s`}
          </button>
        </div>

        {/* Back link */}
        <Link to="/register" className={styles.backLink} id="back-to-register">
          ← Back to Registration
        </Link>

        {/* Security note */}
        <p className={styles.securityNote}>
          🔐 OTP is valid for 5 minutes and can only be used once.
        </p>

      </div>
    </div>
  );
}

export default VerifyOTPPage;
