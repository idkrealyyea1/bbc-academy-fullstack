// API base URL. Default "" = DEMO MODE (no backend configured).
// For production: run `node build.js` with API_BASE_URL set, or edit this
// line to your Render API URL, e.g. "https://bbc-academy-api.onrender.com".
// You can also override at runtime: localStorage.setItem('bbc_api_base', '<url>')
window.BBC_API_BASE = localStorage.getItem('bbc_api_base') || "";
