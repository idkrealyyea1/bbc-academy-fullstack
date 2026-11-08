# Frontend — BBC English Academy (static build for Cloudflare Pages)

Vanilla HTML/CSS/JS, no framework, no build step required for local use.
Self-hosted subset fonts, compressed local photography and no UI libraries —
designed to stay quick on modest connections.

## Run locally (demo mode)

```bash
cd frontend
python3 -m http.server 8000
# open http://localhost:8000/
```

Demo mode is the default: `config.js` has an empty API base, so pages render
the demo catalogue and label demo forms inline. Nothing is really booked,
paid or saved in demo mode.

## Run locally (connected to the real backend)

```bash
cd ../backend && npm install && npm start   # API on http://localhost:4000
cd ../frontend
API_BASE_URL=http://localhost:4000 node build.js
python3 -m http.server 8000
# open http://localhost:8000/ — the real catalogue and forms are used once the API answers
```

Or, without rebuilding: in the browser console / address bar flow, set
`localStorage.setItem('bbc_api_base', 'http://localhost:4000')` then reload.
`build.js` simply rewrites `config.js` from `API_BASE_URL`.

## Deploy (Cloudflare Pages)

See `../docs/DEPLOY.md`. In short: connect this `frontend/` folder, build
command `node build.js`, output directory `.` (the folder itself), and set
the `API_BASE_URL` environment variable to the Render API URL.

## Pages

index, courses, course (detail via `?id=<slug>`),
levels (placement quiz), about, teachers, booking, blog, faq, contact,
login, dashboard-student, dashboard-teacher, dashboard-admin.

No pricing page and no public signup page: students apply via booking and the admin creates
their account after confirmation; dashboards are reached only via login.
Language toggle (top right) switches EN/AR and RTL/LTR and persists in
`localStorage` (`bbc-lang`). Auth token in `localStorage` (`bbc-token`).

## Design system (2026-11 warm editorial refresh)

One coherent warm-editorial system built on the OpenDesign "Warm Editorial"
brief, with no page-specific override stacks:

- `system.css` — tokens, typography, layout primitives and shared components
  (buttons, fields, cards, tables, accordion, alerts, navigation, footer, states).
- `public.css` — public-page compositions only (hero, paths, method, story,
  catalogue, course detail, levels/quiz, FAQ, journal, booking, contact, auth).
- `home.css` — the homepage cover: oversized display headline, photo plate
  with a white caption bar, hairline trust strip, varied section rhythm.
- `dashboard.css` — the student / teacher / admin application shell.
- `page-transition.css` — the paper door transition between pages.

Palette: paper `#fbf8f3` and sand `#f4efe6` surfaces, ink `#1b1917` text,
oxblood `#8a1c26` accent, hairline rules `rgba(27,25,23,.13)`, near-zero
shadows and no gradients. Type: Manrope (UI), Lora (editorial display),
IBM Plex Sans Arabic (Arabic body) and Noto Naskh Arabic (Arabic display),
with logical-property RTL throughout. Both languages are first-class.

Demo and illustrative material is labelled in the UI. Course data, levels and
accounts come from the API when one is configured. No pricing, schedules,
addresses, teacher profiles, statistics or testimonials are invented; the
photography is illustrative and marked where it could imply real staff or
students. A failed API request never becomes a success message.
- Teacher photos on the homepage are illustrative AI-generated placeholders
  (specialism only, no invented names or bios). Replace them with real staff
  photos, with each teacher's consent, before launch.
- The homepage registration form is a demo form in the frontend-only build:
  it shows a success message and does not send or store anything. The
  full-stack build is where real submissions belong.
