/**
 * CSRF Protection Middleware (Stateless Custom Header Approach)
 * 
 * Enforces that all state-changing requests (POST, PUT, DELETE, PATCH)
 * include a custom header `X-Requested-With: XMLHttpRequest`.
 * 
 * Standard HTML form submissions across origins cannot include custom headers
 * without triggering a CORS preflight, which our server will reject for 
 * untrusted origins. This provides robust defense-in-depth against CSRF.
 */
const requireCustomHeaderCSRF = (req, res, next) => {
    // We only care about state-changing methods
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Check for the custom header
    const requestedWith = req.headers['x-requested-with'];
    
    if (!requestedWith || requestedWith !== 'XMLHttpRequest') {
        console.warn(`[CSRF Warning] Blocked request to ${req.path} due to missing or invalid X-Requested-With header.`);
        return res.status(403).json({ 
            error: "Forbidden: Missing CSRF protection header. All POST/PUT/DELETE requests must include 'X-Requested-With: XMLHttpRequest'." 
        });
    }

    next();
};

module.exports = { requireCustomHeaderCSRF };
