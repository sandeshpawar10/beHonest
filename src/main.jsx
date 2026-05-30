/* ============================================================
   main.jsx — React Entry Point
   Mounts the React app into the DOM and wraps it with providers
   ============================================================ */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';              // Global styles (design tokens, reset, animations)
import { AuthProvider } from './context/AuthContext'; // Auth state provider
import App from './App';           // Root component with router

// Mount the React app inside <div id="root"> in index.html
createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* AuthProvider wraps everything so any component can call useAuth() */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
