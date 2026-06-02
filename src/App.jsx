/* ============================================================
   App.jsx — Root Application Component
   Sets up React Router with all page routes and auth protection
   ============================================================ */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

//Route is used to define which component should be shown for a URL.
/*
/login      → Login Page
/dashboard  → Dashboard Page
/profile    → Profile Page
*/

/*🔄 Navigate

Navigate is used to send (redirect) the user to another URL.
Think of it as:

"Don't stay on this page, move to another page."
*/


import { useAuth } from './context/AuthContext'; //Access authentication data from AuthContext

// Page components (each is a separate route)
import LoginPage       from './pages/LoginPage';
import RegisterPage    from './pages/RegisterPage';
import VerifyOTPPage   from './pages/VerifyOTPPage';
import DashboardPage   from './pages/DashboardPage';
import ReportFoundPage from './pages/ReportFoundPage'; // Feature 2: finder uploads item
import FoundItemsPage  from './pages/FoundItemsPage';  // Feature 2: public listing with blur

// ── ProtectedRoute Component ───────────────────────────────────
// Wraps any route that requires authentication.
// If the user is NOT logged in → redirects to /login
// If the user IS logged in → renders the requested page
function ProtectedRoute({ children }) {
  const { isLoggedIn, loading } = useAuth(); // Get auth state from context

  // While session is being restored from localStorage, show nothing
  // (prevents flash of redirect before auth check completes)
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', color: 'var(--accent-cyan)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return children; // Logged in → render the protected page
}

// ── PublicRoute Component ──────────────────────────────────────
// Wraps auth pages (login, register, otp).
// If the user IS already logged in → redirects to /dashboard
// If NOT logged in → renders the auth page normally
function PublicRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();

  // Wait for auth check before rendering
  if (loading) return null;

  // Already logged in → skip login/register pages
  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />;
  }

  return children; // Not logged in → show the auth page
}

// ── Main App Component with Router ────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Default route → redirect to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Login page — public only (redirects to dashboard if logged in) */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Registration page — public only */}
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />

        {/* OTP verification page — public (reached after register) */}
        <Route
          path="/verify-otp"
          element={
            <PublicRoute>
              <VerifyOTPPage />
            </PublicRoute>
          }
        />

        {/* Dashboard — PROTECTED (requires login) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Report Found Item — PROTECTED (must be a verified student) */}
        <Route
          path="/report-found"
          element={
            <ProtectedRoute>
              <ReportFoundPage />
            </ProtectedRoute>
          }
        />

        {/* Found Items Listing — PROTECTED (browse found items) */}
        <Route
          path="/found-items"
          element={
            <ProtectedRoute>
              <FoundItemsPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all → redirect unknown routes to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
