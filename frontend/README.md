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

index, courses (grouped by section, with add-a-course form), course (detail via `?id=<slug>`),
levels (placement quiz), about, teachers, booking, blog, faq, contact,
login, dashboard-student, dashboard-teacher, dashboard-admin.

No pricing page and no public signup page: students apply via booking and the admin creates
their account after confirmation; dashboards are reached only via login.
Language toggle (top right) switches EN/AR and RTL/LTR and persists in
`localStorage` (`bbc-lang`). Auth token in `localStorage` (`bbc-token`).

## Design — shared with the frontend-only demo (2026-11-02 redesign)

This frontend is the new design, identical to the frontend-only demo: cream/navy/red system
(`new-home.css` on the main page, `unified.css` + main-page header/footer on the other pages),
BBC B-B-C mark, luxury black/red login page, page transition between pages, and the desktop
English hero fix.
Client-facing pages carry no visible TODO / demo text; the full honesty
list (unverified hero stats, teachers by specialism only, "Fees on
enquiry", no address/phone invented, BBC-affiliation disclaimer, classroom
photo is generic) is in the frontend-only README and in code comments.
When no backend is connected, pages fall back to catalogue data and show
no on-page banner (fallback behaviour is documented here and in `app.js`
comments, not splashed across the client site).

## Homepage (new reference, index.html only)
Same homepage as the frontend-only demo: navy top bar with centred BBC logo, full-bleed photo hero (`hero-home.jpg`), stacked CTAs, 3-feature card and 3-stat card. Other pages keep the dark/red identity.
**Homepage stats (+10,000 students, 95% success rate, 5.0 student rating) are design placeholders from the reference screenshot — NOT verified facts. Owner must confirm/correct before public launch.**

## Homepage placeholders (owner must replace before public launch)
- Hero stats (+10,000 / 95% / 5.0) are the figures from the reference screenshot
  and are NOT verified academy figures — the owner must confirm or correct them.
- Teacher photos on the homepage are illustrative AI-generated placeholders
  (specialism only, no invented names or bios). Replace them with real staff
  photos, with each teacher's consent, before launch.
- The homepage registration form is a demo form in the frontend-only build:
  it shows a success message and does not send or store anything. The
  full-stack build is where real submissions belong.
