/* ============================================================
   main.jsx — React Entry Point
   Mounts the React app into the DOM and wraps it with providers
   ============================================================ */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Local fonts for reliable offline and mobile loading
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

import '@fontsource/outfit/400.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import '@fontsource/outfit/800.css';

import './index.css';              // Global styles (design tokens, reset, animations)
import { AuthProvider } from './context/AuthContext'; // Auth state provider
import App from './App';           // Root component with router

// --- Global Fetch CSRF Interceptor ---
// Automatically injects the X-Requested-With header into all state-changing requests
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  
  if (config && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(config.method?.toUpperCase())) {
    config.headers = {
      ...config.headers,
      'X-Requested-With': 'XMLHttpRequest'
    };
  }
  
  return originalFetch(resource, config);
};

// Mount the React app inside <div id="root"> in index.html
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* AuthProvider wraps everything so any component can call useAuth() */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
