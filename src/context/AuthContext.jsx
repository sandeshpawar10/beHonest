/* ============================================================
   AuthContext.jsx — React Context for Authentication State
   
   Provides auth state (session, loading) and actions (login,
   logout, register) to any component in the app via useAuth() hook.
   
   Wrap <App /> with <AuthProvider> in main.jsx so every component
   can access auth without prop drilling.
   ============================================================ */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getSession,      // Read current session from localStorage
  createSession,   // Write a new session to localStorage
  destroySession,  // Remove session from localStorage
  loginUser,       // Authenticate email + password
  registerUser,    // Create a new user account
  createAndStoreOTP, // Generate and store OTP
  verifyOTP,       // Verify user-submitted OTP
} from '../utils/authUtils';

// ── Create the context object ──────────────────────────────────
// Components import useAuth() to consume this context
const AuthContext = createContext(null);

// ── AuthProvider Component ─────────────────────────────────────
// Wraps the entire app and provides auth state globally
export function AuthProvider({ children }) {

  // session: the current logged-in user's session object (or null if logged out)
  const [session, setSession] = useState(null);

  // loading: true while we check localStorage on first mount
  const [loading, setLoading] = useState(true);

  /* ── On mount: restore session from localStorage ──
     When the React app starts, check if a valid session already exists.
     This keeps users logged in across page refreshes. */
  useEffect(() => {
    const existingSession = getSession(); // Check localStorage for saved session
    if (existingSession) {
      setSession(existingSession);        // Restore the session into React state
    }
    setLoading(false);                    // Done checking — unblock the router
  }, []); // Empty dep array = run once on mount only

  /* ── login action ─────────────────────────────────────────
     Called from the Login page.
     Returns { success, reason } so the page can show feedback. */
  const login = useCallback((email, password) => {
    const result = loginUser(email, password); // Run auth logic

    if (result.success) {
      createSession(result.user);  // Persist the session to localStorage
      setSession(getSession());    // Update React state with the new session
    }

    return result; // Let the caller decide what UI to show
  }, []);

  /* ── logout action ────────────────────────────────────────
     Called from any component (e.g., Navbar logout button).
     Clears session from localStorage and React state. */
  const logout = useCallback(() => {
    destroySession();     // Remove from localStorage
    setSession(null);     // Clear React state → triggers redirect in ProtectedRoute
  }, []);

  /* ── sendOTP action ───────────────────────────────────────
     Called from the Register page after form validation.
     Generates OTP, stores it, and returns { success, otp }. */
  const sendOTP = useCallback((email) => {
    const otp = createAndStoreOTP(email); // Generate + store + console.log
    return { success: true, otp };
  }, []);

  /* ── confirmOTP action ────────────────────────────────────
     Called from the VerifyOTP page.
     Returns { success, reason } based on OTP match. */
  const confirmOTP = useCallback((email, submittedOTP) => {
    return verifyOTP(email, submittedOTP); // Returns { success, reason }
  }, []);

  /* ── register action ──────────────────────────────────────
     Called after OTP is verified on the VerifyOTP page.
     Creates user account and auto-logs them in. */
  const register = useCallback((fullName, email, password) => {
    const result = registerUser(fullName, email, password); // Create user record

    if (result.success) {
      // Auto-login after successful registration (no need to re-enter credentials)
      createSession(result.user);
      setSession(getSession());
    }

    return result;
  }, []);

  // ── Value object passed to all consumers ──────────────────
  // Any component using useAuth() gets these values and functions
  const value = {
    session,   // Current session object (null = not logged in)
    loading,   // True while restoring session on first load
    isLoggedIn: session !== null, // Computed boolean for convenience
    login,
    logout,
    sendOTP,
    confirmOTP,
    register,
  };

  return (
    // Provide auth state to all child components
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ── useAuth Hook ───────────────────────────────────────────────
// Shorthand for consuming the AuthContext in any component
// Usage: const { session, login, logout } = useAuth();
export function useAuth() {
  const context = useContext(AuthContext);

  // Throw a clear error if useAuth() is used outside <AuthProvider>
  if (!context) {
    throw new Error('useAuth() must be used inside an <AuthProvider> component.');
  }

  return context;
}
