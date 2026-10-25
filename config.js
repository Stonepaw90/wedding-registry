// Wedding registry configuration.
// Fill in after deploying Google Apps Script (see README.md).
window.REGISTRY_CONFIG = {
  // Apps Script web app URL (ends with /exec). Leave empty to run in demo mode (localStorage).
  endpoint: "https://script.google.com/macros/s/AKfycbw8poEmajzYzshV43G0YkHT2SIQJwDQAjKmLlrkvfD_vCfQT9eqmltMZpBGxlGbhH_y0g/exec",
  // The admin token is NOT stored here. admin.html prompts for it and keeps it
  // only in sessionStorage, because GitHub Pages serves every file publicly.
  // Couple display overrides (also editable in index.html)
  couple: "Emma & Abraham",
  weddingDate: "April 18, 2027",
  // Polling interval (ms) for refreshing availability
  pollMs: 30000,
};