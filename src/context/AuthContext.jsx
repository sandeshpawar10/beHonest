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
    // Fetch the user session from the backend securely
    const fetchSession = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/user/me', {
          method: 'GET',
          credentials: 'include' // Important for sending the httpOnly cookie
        });
        
        if (response.ok) {
          const data = await response.json();
          setSession(data.user);
        } else {
          setSession(null);
        }
      } catch (error) {
        console.error("Failed to fetch session:", error);
        setSession(null);
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, []);

  // Called after a successful backend login
  const loginSuccess = useCallback((user) => {
    setSession(user);
  }, []);

  // Called to logout
  const logout = useCallback(async () => {
    try {
      await fetch('http://localhost:8000/api/user/logout', { 
        method: 'POST',
        credentials: 'include'
      });
    } catch(e) {
      console.error(e);
    }
    setSession(null);
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
