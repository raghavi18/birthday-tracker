// =========================================================================
// Birthday Tracker — Frontend configuration.
// Edit API_BASE to point at your deployed backend (Render/Railway/etc).
// During local dev this defaults to http://localhost:5050.
// =========================================================================
window.APP_CONFIG = {
  // When the page is loaded from a file:// URL or localhost, hit the local Flask.
  // Otherwise use the production backend URL.
  API_BASE: (function () {
    const host = window.location.hostname;
    if (!host || host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:5050";
    }
    // CHANGE THIS to your deployed backend URL when you publish to GitHub Pages.
    return "https://YOUR-BACKEND.onrender.com";
  })(),
};
