# Frontend — BBC English Academy (static build for Cloudflare Pages)

Vanilla HTML/CSS/JS, no framework, no build step required for local use.
No heavy images, no 3D, system fonts only — designed for low-bandwidth users.

## Run locally (demo mode)

```bash
cd frontend
python3 -m http.server 8000
# open http://localhost:8000/
```

Demo mode is the default: `config.js` has an empty API base, so pages render
demo data and show a yellow **DEMO MODE** banner. Nothing is really booked,
paid or saved in demo mode.

## Run locally (connected to the real backend)

```bash
cd ../backend && npm install && npm start   # API on http://localhost:4000
cd ../frontend
API_BASE_URL=http://localhost:4000 node build.js
python3 -m http.server 8000
# open http://localhost:8000/ — the banner disappears once the API answers
```

Or, without rebuilding: in the browser console / address bar flow, set
`localStorage.setItem('bbc_api_base', 'http://localhost:4000')` then reload.
`build.js` simply rewrites `config.js` from `API_BASE_URL`.

## Deploy (Cloudflare Pages)

See `../docs/DEPLOY.md`. In short: connect this `frontend/` folder, build
command `node build.js`, output directory `.` (the folder itself), and set
the `API_BASE_URL` environment variable to the Render API URL.

## Pages

index, courses, course (detail via `?id=<slug>`), levels (20-question scored
placement quiz), about, teachers, pricing, booking, blog, faq, contact,
login, signup, dashboard-student, dashboard-teacher, dashboard-admin.
Language toggle (top right) switches EN/AR and RTL/LTR and persists in
`localStorage` (`bbc-lang`). Auth token in `localStorage` (`bbc-token`).
