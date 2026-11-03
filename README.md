# BBC English Academy — Full-Stack Platform

**Status: LIVE 2026-11-03 — Pages: https://bbc-academy.pages.dev/ · API: https://bbc-academy-fullstack.onrender.com · Database: Supabase project `bbc-academy` (migrations 001–004 applied; **005_fixes.sql pending**, see
`docs/DEPLOY.md` §1, SEED_DEMO=false).**

A complete learning platform for an English academy: public site, CEFR
levels, a scored placement test, enrolment, lessons, assignments + grading,
attendance, announcements, and student / teacher / admin dashboards — in
Arabic and English (RTL/LTR), built light for low-bandwidth students.

**Not affiliated with the British Broadcasting Corporation (BBC). No BBC
logos or BBC branding are used.** "BBC English Academy" is the academy's own
name as given by the owner; if the owner wants a different name, confirm it
before launch (see TODOs).

Based on the strongest existing repo (`BBC`: vanilla HTML/CSS/JS + EN/AR +
student/admin dashboards + Google Sheets backend) — this build replaces the
Sheets/Apps Script backend with a real API + Supabase PostgreSQL, and adds
the missing pieces: teacher dashboard, placement test, lessons, assignments,
grades, attendance, real auth. The old repo's 7.5 MB photo and its hardcoded
Apps Script URL were **not** copied or reused.

## Layout

```
bbc-fullstack/
├── frontend/     Static site for Cloudflare Pages (vanilla HTML/CSS/JS)
│                 config.js = API base ("" = demo mode), build.js = CI helper
├── backend/      Node + Express API (src/server.js, src/db.js)
│                 Dockerfile, .env.example, render.yaml at repo root
├── db/           Supabase PostgreSQL migrations + README
│   ├── migrations/001_init.sql  002_rls.sql  003_storage.sql
│   └── supabase/seed.sql        (demo data only)
├── docs/         DEPLOY.md, ARCHITECTURE.md, API.md
└── README.md     (this file)
```

## Run everything locally

```bash
# 1. Backend (in-memory demo store — no database needed)
cd backend
npm install
npm start
# API on http://localhost:4000 — check http://localhost:4000/api/health

# 2. Frontend, connected to the local backend (new terminal)
cd ../frontend
API_BASE_URL=http://localhost:4000 node build.js
python3 -m http.server 8000
# open http://localhost:8000/ — no DEMO MODE banner once the API answers
```

Local Postgres instead of the in-memory store (optional):

```bash
createdb bbc_academy
psql bbc_academy < ../db/migrations/001_init.sql
psql bbc_academy < ../db/migrations/002_rls.sql
DATABASE_URL=postgres://localhost:5432/bbc_academy npm --prefix ../backend start
```

Frontend in pure demo mode (no backend at all):

```bash
cd frontend
python3 -m http.server 8000   # config.js default "" → yellow DEMO MODE banner
```

## Demo accounts (demo only — never real credentials)

Seeded automatically by the backend only when `SEED_DEMO=true`, or when
`SEED_DEMO` is unset and `NODE_ENV` is not `production` (so a local run gets
them, a production run does not). Password for all three: `Demo1234!`

| Role | Email |
|---|---|
| Student | `student@demo.local` |
| Teacher | `teacher@demo.local` |
| Admin | `admin@demo.local` |

In pure frontend demo mode (no backend), the same three accounts work on
that device only and nothing is saved on a server.

## What is real vs placeholder

| Feature | Status |
|---|---|
| Pages, EN/AR toggle, RTL/LTR, responsive layout | Real |
| JWT auth, bcrypt passwords, roles, rate limiting, CORS allow-list | Real |
| Courses, levels, lessons, enrolments, placement results, assignments, submissions, grades, attendance, announcements | Real (API + DB schema) |
| Placement test (20 questions, server-scored, CEFR bands) | Real scoring; questions are generic grammar/vocabulary, not an official exam |
| Dashboards (student / teacher / admin) | Real in connected mode: role-guarded, real API data. Student: courses, level, attendance, homework + submission form, self-enrol from the course page, password change. Teacher: classes, grading, attendance, announcements, and creating lessons + assignments. Admin: bookings → create student account + enrol, user roles + password resets, course→teacher assignment, enrolments. Every role can change its own password |
| Booking → account journey | Real: anonymous booking request (with email) → admin confirms → admin creates the student account and enrols them → student logs in |
| Live classes | Link field only (`live_class_url`) — teacher pastes a Zoom/Meet link; no video platform built in |
| Payments | **PLACEHOLDER ONLY** — records an intent/status, no provider, no keys, no money moves |
| Email sending | **Placeholder** — no provider wired; announcements are in-platform |
| File uploads to Storage | Buckets defined in SQL; API upload wiring is a TODO |
| Certificates (per-level, QR-verified) | **TODO** — not built yet |
| Prices, address, phone, staff names, schedules | **TODO placeholders** — see below; never publish as real |

## TODOs needing عمرو / the academy owner

1. **Real academy details:** exact trading name (and whether "BBC" is OK to
   use publicly), address, phone/WhatsApp, email, hours, delivery mode
   (in-person / online / hybrid), class sizes, schedules.
2. **Real courses & prices:** course names, CEFR levels, durations, and
   prices + currency. Current prices are NULL / "XX" placeholders on purpose.
3. **Real teachers:** names, photos, bios, qualifications — with consent.
   Current teacher profiles are invented demo placeholders.
4. **Supabase project:** create it and run the migrations (docs/DEPLOY.md §1).
5. **Payment provider decision:** which provider (if any) actually works for
   Gaza students — do NOT assume Stripe/PayPal. Until decided, payments stay
   placeholder-only.
6. **Domain:** confirm the custom domain for Cloudflare Pages (docs/DEPLOY.md §3).
7. **Certificates:** confirm whether the academy issues its own certificates
   and whether a QR verification page is wanted (recommended; never claim an
   external accreditation the academy does not hold).
8. **Email provider:** choose one if account emails / notifications are wanted.
9. **Content:** real blog/news, FAQ answers (refunds, certificates, pauses),
   and About text.
10. **Review & approval:** nothing is pushed or deployed without عمرو's
    review — this local build is for that review.

## Deploy

See `docs/DEPLOY.md` (Supabase → Render → Cloudflare Pages, in that order),
`docs/ARCHITECTURE.md` for the design, and `docs/API.md` for every endpoint.
