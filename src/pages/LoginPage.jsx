/* ============================================================
   LoginPage.jsx — Login Page Component
   Route: /login
   Features: college email validation, password toggle,
             error display, loading state, redirect if logged in
   ============================================================ */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLayout from '../components/ui/AuthLayout';
import InputField from '../components/ui/InputField';
import { isValidEmailFormat, isCollegeEmail } from '../utils/authUtils';
import styles from './AuthPages.module.css';

function LoginPage() {
  const navigate  = useNavigate();  // For programmatic navigation after login
  const { login } = useAuth();      // Get the login action from AuthContext

  // ── Form State ────────────────────────────────────────────
  const [email,    setEmail]    = useState(''); // College email input
  const [password, setPassword] = useState(''); // Password input
  const [loading,  setLoading]  = useState(false); // Button loading state
  const [error,    setError]    = useState('');     // Error message to display
  const [shake,    setShake]    = useState(false);  // Triggers shake animation on error

  // ── Field-level errors ────────────────────────────────────
  const [emailErr, setEmailErr] = useState('');

  // ── Clear error when user starts typing ──────────────────
  // Better UX: error disappears the moment they try to fix it
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    setError('');
    setEmailErr('');
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setError('');
  };

  // ── Form Submission Handler ───────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent browser default form submit (page reload)
    setError('');

    // Client-side validation before calling auth
    if (!email.trim()) {
      setEmailErr('College email is required.');
      return;
    }
    if (!isValidEmailFormat(email)) {
      setEmailErr('Please enter a valid email address.');
      return;
    }
    if (!isCollegeEmail(email)) {
      setEmailErr('Only college/university emails are allowed (.edu, .ac.in, etc.)');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    // Start loading state — disables button and shows spinner
    setLoading(true);

    // Simulate a small network delay for realistic UX
    await new Promise(r => setTimeout(r, 800));

    // Call the login action from AuthContext
    const result = login(email.trim(), password);

    setLoading(false);

    if (!result.success) {
      // Show the error reason from the auth function
      setError(result.reason);
      // Trigger the shake animation on the form card
      setShake(true);
      setTimeout(() => setShake(false), 500); // Remove class after animation
      return;
    }

    // ✅ Login successful → navigate to dashboard
    navigate('/dashboard', { replace: true });
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <AuthLayout tagline="The AI-powered Lost & Found platform built exclusively for college students. Secure. Fair. Honest.">

      {/* Form card (right-panel slot) */}
      <div className={`${styles.card} ${shake ? styles.shake : ''}`}>

        {/* Page heading */}
        <h1 className={styles.heading}>Welcome back 👋</h1>
        <p className={styles.subtitle}>
          Sign in with your college email.{' '}
          <Link to="/register" className={styles.link}>New here? Register</Link>
        </p>

        {/* Global error alert (for auth errors like wrong password) */}
        {error && (
          <div className={styles.alert} role="alert" aria-live="polite">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit} className={styles.form} noValidate>

          {/* College Email */}
          <InputField
            label="College Email Address"
            id="login-email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="you@college.edu"
            icon="✉️"
            error={emailErr}
            hint="Must be a college email (.edu, .ac.in, etc.)"
            autoComplete="email"
            required
          />

          {/* Password */}
          <div>
            <InputField
              label="Password"
              id="login-password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              placeholder="Enter your password"
              icon="🔑"
              showToggle={true}  /* Adds the 👁️ toggle button */
              autoComplete="current-password"
              required
            />
            {/* Forgot password link — tucked right below the field */}
            <a href="#" className={styles.forgotLink} id="forgot-password-link">
              Forgot your password?
            </a>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            id="login-submit-btn"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading
              ? <><span className={styles.spinner}></span> Signing in...</>
              : 'Sign In to beHonest'
            }
          </button>

        </form>

        {/* Divider */}
        <div className={styles.divider}><span>or</span></div>

        {/* Register link */}
        <p className={styles.altLink}>
          Don't have an account?{' '}
          <Link to="/register" id="go-to-register">Register with college email</Link>
        </p>

      </div>
    </AuthLayout>
  );
}

export default LoginPage;
