/* ============================================================
   AuthContext.jsx — React Context for Authentication State
   
   Provides auth state (session, loading) and actions (login,
   logout, register) to any component in the app via useAuth() hook.
   
   Wrap <App /> with <AuthProvider> in main.jsx so every component
   can access auth without prop drilling.
   ============================================================ */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createAndStoreOTP, verifyOTP } from '../utils/authUtils';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Temporary UI persistence while waiting for a backend /me endpoint
    const existingSession = localStorage.getItem('bh_session');
    if (existingSession) {
      try {
        setSession(JSON.parse(existingSession));
      } catch(e) {}
    }
    setLoading(false);
  }, []);

  // Called after a successful backend login
  const loginSuccess = useCallback((user) => {
    setSession(user);
    localStorage.setItem('bh_session', JSON.stringify(user));
  }, []);

  // Called to logout
  const logout = useCallback(async () => {
    try {
      await fetch('http://localhost:8000/api/user/logout', { 
        method: 'POST',
        // In real production, include credentials: 'include' if cookies are cross-origin
      });
    } catch(e) {
      console.error(e);
    }
    setSession(null);
    localStorage.removeItem('bh_session');
  }, []);

  // Kept for OTP testing until backend email service is built
  const sendOTP = useCallback((email) => {
    const otp = createAndStoreOTP(email);
    return { success: true, otp };
  }, []);

  const confirmOTP = useCallback((email, submittedOTP) => {
    return verifyOTP(email, submittedOTP);
  }, []);

  const value = {
    session,
    loading,
    isLoggedIn: session !== null,
    loginSuccess,
    logout,
    sendOTP,
    confirmOTP,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth() must be used inside an <AuthProvider> component.');
  }
  return context;
}
