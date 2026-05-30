/* ============================================================
   RegisterPage.jsx — Registration Page Component
   Route: /register
   Features: real-time email validation, password strength meter,
             confirm password matching, OTP trigger on submit
   ============================================================ */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/ui/AuthLayout';
import InputField from '../components/ui/InputField';
import {
  validateCollegeEmail, // Full college email check
  validatePassword,     // Password strength evaluator
  isEmailTaken,         // Check if email already registered
} from '../utils/authUtils';
import styles from './AuthPages.module.css';

function RegisterPage() {
  const navigate  = useNavigate();
  const { sendOTP } = useAuth(); // Get sendOTP action from context

  // ── Form field state ──────────────────────────────────────
  const [fullName,    setFullName]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // ── Loading and global message state ─────────────────────
  const [loading, setLoading] = useState(false);
  const [alert,   setAlert]   = useState({ msg: '', type: '' }); // { msg, type: 'error'|'success' }

  // ── Per-field error messages ──────────────────────────────
  const [nameErr,    setNameErr]    = useState('');
  const [emailErr,   setEmailErr]   = useState('');
  const [emailOk,    setEmailOk]    = useState(false);  // True = valid college email (shows ✅ badge)
  const [pwErr,      setPwErr]      = useState('');
  const [pwStrength, setPwStrength] = useState('');     // 'weak' | 'medium' | 'strong'
  const [confirmErr, setConfirmErr] = useState('');

  // ── Real-time email validation ────────────────────────────
  // Runs as user types — debounced by React's own batching
  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    setAlert({ msg: '', type: '' });

    if (!val.trim()) {
      setEmailErr(''); setEmailOk(false); return;
    }
    const result = validateCollegeEmail(val);
    if (result.valid) {
      setEmailErr('');   // Clear error
      setEmailOk(true);  // Show green ✅ badge
    } else {
      setEmailErr(result.reason);
      setEmailOk(false);
    }
  };

  // ── Real-time password strength evaluation ────────────────
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    setPwErr('');

    if (!val) { setPwStrength(''); return; }

    const result = validatePassword(val);
    setPwStrength(result.strength); // 'weak' | 'medium' | 'strong'
    if (!result.valid) setPwErr(result.reason);

    // Re-check confirm field if it already has content
    if (confirmPw) validateConfirm(val, confirmPw);
  };

  // ── Confirm password real-time matching ──────────────────
  const handleConfirmChange = (e) => {
    const val = e.target.value;
    setConfirmPw(val);
    validateConfirm(password, val);
  };

  const validateConfirm = (pw1, pw2) => {
    if (!pw2) { setConfirmErr(''); return; }
    setConfirmErr(pw1 === pw2 ? '' : 'Passwords do not match.');
  };

  // ── Password strength bar props ───────────────────────────
  // Returns { width, color } based on strength level
  const strengthBarProps = {
    weak:   { width: '33%', color: 'var(--color-error)',   label: 'Weak' },
    medium: { width: '66%', color: 'var(--color-warning)', label: 'Medium' },
    strong: { width: '100%', color: 'var(--color-success)', label: 'Strong 💪' },
  }[pwStrength] || { width: '0%', color: 'transparent', label: '' };

  // ── Form Submission ───────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ msg: '', type: '' });

    let hasError = false;

    // Validate full name
    if (!fullName.trim()) {
      setNameErr('Full name is required.');
      hasError = true;
    } else { setNameErr(''); }

    // Validate college email
    const emailResult = validateCollegeEmail(email);
    if (!emailResult.valid) {
      setEmailErr(emailResult.reason);
      setEmailOk(false);
      hasError = true;
    }

    // Validate password
    const pwResult = validatePassword(password);
    if (!pwResult.valid) {
      setPwErr(pwResult.reason);
      hasError = true;
    }

    // Validate confirm password
    if (password !== confirmPw) {
      setConfirmErr('Passwords do not match.');
      hasError = true;
    }

    // Validate terms acceptance
    if (!acceptTerms) {
      setAlert({ msg: 'Please accept the Terms of Service to continue.', type: 'warning' });
      hasError = true;
    }

    if (hasError) return;

    // Check if email already exists in localStorage
    if (isEmailTaken(email)) {
      setAlert({ msg: 'This email is already registered. Please log in.', type: 'error' });
      return;
    }

    // All valid — send OTP
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200)); // Simulated API delay

    sendOTP(email.trim()); // Generates OTP and stores it in localStorage

    setAlert({
      msg: `OTP sent to ${email}! Check your inbox (Dev: see browser console).`,
      type: 'success'
    });

    // Store registration data in sessionStorage so VerifyOTPPage can complete registration
    // NOTE: In production, never store plain password client-side — hash on server
    sessionStorage.setItem('bh_reg_pending', JSON.stringify({
      fullName: fullName.trim(),
      email:    email.trim().toLowerCase(),
      password, // Temporary — cleared after registration is complete
    }));

    await new Promise(r => setTimeout(r, 1200)); // Let user read success message

    setLoading(false);

    // Navigate to OTP verification page, passing email and context as query params
    navigate(`/verify-otp?email=${encodeURIComponent(email)}&context=register`);
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <AuthLayout tagline="Join the most trusted lost & found network on your campus. Your college email is your passport.">

      <div className={styles.card}>

        <h1 className={styles.heading}>Create your account</h1>
        <p className={styles.subtitle}>
          Registration is open to verified college students only.
          You'll receive an OTP on your college email.
        </p>

        {/* Global alert (error or success) */}
        {alert.msg && (
          <div className={`${styles.alert} ${styles[`alert_${alert.type}`]}`} role="alert">
            <span>{alert.type === 'success' ? '✅' : alert.type === 'warning' ? '🔔' : '⚠️'}</span>
            {alert.msg}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form} noValidate>

          {/* Full Name */}
          <InputField
            label="Full Name"
            id="reg-fullname"
            type="text"
            value={fullName}
            onChange={e => { setFullName(e.target.value); setNameErr(''); }}
            placeholder="John Doe"
            icon="👤"
            error={nameErr}
            autoComplete="name"
            maxLength={80}
            required
          />

          {/* College Email */}
          <div>
            <InputField
              label="College Email Address"
              id="reg-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="you@college.edu"
              icon="🎓"
              error={emailErr}
              success={emailOk}
              hint="Accepted: .edu · .ac.in · .edu.in · .ac.uk and more"
              autoComplete="email"
              required
            />
            {/* ✅ Badge shown when email is a valid college email */}
            {emailOk && (
              <div className={styles.collegeBadge} aria-live="polite">
                ✅ College email verified
              </div>
            )}
          </div>

          {/* Password */}
          <div>
            <InputField
              label="Password"
              id="reg-password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Min. 8 characters"
              icon="🔒"
              showToggle={true}
              error={pwErr}
              autoComplete="new-password"
              required
            />
            {/* Password strength meter (only visible when user types) */}
            {pwStrength && (
              <div className={styles.strengthMeter} aria-label={`Password strength: ${strengthBarProps.label}`}>
                <div className={styles.strengthTrack}>
                  {/* Animated fill bar — width and color based on strength */}
                  <div
                    className={styles.strengthFill}
                    style={{ width: strengthBarProps.width, background: strengthBarProps.color }}
                  />
                </div>
                <span className={styles.strengthLabel} style={{ color: strengthBarProps.color }}>
                  {strengthBarProps.label}
                </span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <InputField
            label="Confirm Password"
            id="reg-confirm"
            type="password"
            value={confirmPw}
            onChange={handleConfirmChange}
            placeholder="Re-enter your password"
            icon="🔒"
            showToggle={true}
            error={confirmErr}
            success={confirmPw.length > 0 && !confirmErr}
            autoComplete="new-password"
            required
          />

          {/* Terms & Conditions checkbox */}
          <label className={styles.termsRow} htmlFor="terms-checkbox">
            <input
              type="checkbox"
              id="terms-checkbox"
              checked={acceptTerms}
              onChange={e => setAcceptTerms(e.target.checked)}
              className={styles.checkbox}
            />
            <span>
              I agree to the{' '}
              <a href="#" id="terms-link" className={styles.link}>Terms of Service</a>
              {' '}and{' '}
              <a href="#" id="privacy-link" className={styles.link}>Privacy Policy</a>.
              Platform is for college students only.
            </span>
          </label>

          {/* Submit button */}
          <button
            type="submit"
            id="reg-submit-btn"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading
              ? <><span className={styles.spinner}></span> Sending OTP...</>
              : 'Send OTP to College Email 📧'
            }
          </button>

        </form>

        {/* Already have an account */}
        <p className={styles.altLink} style={{ marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" id="go-to-login">Sign in here</Link>
        </p>

      </div>
    </AuthLayout>
  );
}

export default RegisterPage;
