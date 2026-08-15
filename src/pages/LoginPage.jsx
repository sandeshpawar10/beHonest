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

import styles from './AuthPages.module.css';

function LoginPage() {
  const navigate  = useNavigate();  // For programmatic navigation after login
  const { refreshSession } = useAuth(); // Get the loginSuccess action from AuthContext

  // ── Form State ────────────────────────────────────────────
  const [email,    setEmail]    = useState(''); // College email input
  const [password, setPassword] = useState(''); // Password input
  const [loading]  = useState(false); // Button loading state
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
  // const handleSubmit = async (e) => {
  //   e.preventDefault(); // Prevent browser default form submit (page reload)
  //   setError('');

  //   // Client-side validation before calling auth
  //   if (!email.trim()) {
  //     setEmailErr('College email is required.');
  //     return;
  //   }
  //   if (!isValidEmailFormat(email)) {
  //     setEmailErr('Please enter a valid email address.');
  //     return;
  //   }
  //   if (!isCollegeEmail(email)) {
  //     setEmailErr('Only college/university emails are allowed (.edu, .ac.in, etc.)');
  //     return;
  //   }
  //   if (!password) {
  //     setError('Password is required.');
  //     return;
  //   }

  //   // Start loading state — disables button and shows spinner
  //   setLoading(true);

  //   // Simulate a small network delay for realistic UX
  //   await new Promise(r => setTimeout(r, 800));

  //   // Call the login action from AuthContext
  //   const result = login(email.trim(), password);

  //   setLoading(false);

  //   if (!result.success) {
  //     // Show the error reason from the auth function
  //     setError(result.reason);
  //     // Trigger the shake animation on the form card
  //     setShake(true);
  //     setTimeout(() => setShake(false), 500); // Remove class after animation
  //     return;
  //   }

  //   // ✅ Login successful → navigate to dashboard
  //   navigate('/dashboard', { replace: true });
  // };

  const handleLoginSubmit = async (e)=> {
    e.preventDefault()

    try {
      console.log(email)
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/user/login`,{
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type' : 'application/json'
        },
        body: JSON.stringify({
          //username: fullName,
          email: email.trim(),
          password: password
        })
      })
      const data = await response.json()
      if(response.ok){
        await refreshSession(); // Fetch full user data including username
        console.log("Navigating to dashboard...");
        navigate('/dashboard', { replace: true });
      }
      else{
        setError(data.message || "Login failed");
        // Trigger the shake animation on the form card
        setShake(true);
        setTimeout(() => setShake(false), 500); // Remove class after animation
        return;
      }

    } catch (err) {
      console.error("Failed to connect to the backend server:", err);
      setError("Failed to connect to the server. Please check your internet connection or try again later.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

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
        <form onSubmit={handleLoginSubmit} className={styles.form} noValidate>

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
            {/* Forgot Password Link */}
            <div className={styles.forgotPassword}>
              <Link to="/forgot-password" className={styles.forgotLink}>
                Forgot your password?
              </Link>
            </div>
          </div>

          {/* Submit button */}
          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <><span className="btnSpinner"></span> Logging in...</> : 'Login securely'}
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
