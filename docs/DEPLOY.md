# Deploy — BBC English Academy (step by step)

LIVE 2026-11-03: Supabase project `bbc-academy`, Render `https://bbc-academy-fullstack.onrender.com`
(/api/health store: postgres), Cloudflare Pages `https://bbc-academy.pages.dev/` with
API_BASE_URL set to the Render URL. Migrations 001-004 applied;
**005_fixes.sql must be applied** — the current API writes
`booking_requests.email` and upserts `grades` on `submission_id`. SEED_DEMO=false in production.

## 1. Supabase — database

1. Go to https://supabase.com/dashboard → **New project**. Pick a name
   (e.g. `bbc-academy`), a database password (save it in a password manager —
   never in this repo), and the closest region.
2. Wait for provisioning, then open **SQL Editor → New query**.
3. Paste and run, in this exact order, waiting for each to succeed:
   - `db/migrations/001_init.sql`
   - `db/migrations/002_rls.sql`
   - `db/migrations/003_storage.sql` (optional but recommended)
   - `db/migrations/004_booking_requests.sql`
   - `db/migrations/005_fixes.sql` — adds `booking_requests.email` and makes
     `grades` one row per submission. The API needs both; without it, booking
     requests and grading fail.
   - `db/supabase/seed.sql` — demo data only. Skip on a production project
     until the owner confirms the demo catalogue is wanted.
4. **Auth users:** create real users one of these ways (do NOT use the
   seed file's placeholder-hash rows to log in):
   - Via the API after step 2: `POST /api/auth/register` with the Render URL
     (passwords are bcrypt-hashed by the API), or
   - Via Supabase Dashboard → **Authentication → Users → Add user**, then
     insert a matching `profiles` row with `id = <that user's id>`.
   - For the first admin: set `ADMIN_SETUP_KEY` on Render (step 2) and
     register with header `x-admin-setup-key: <key>`, or create the admin
     directly in the SQL Editor.
5. **Storage buckets:** verify under **Storage** that `avatars` (public)
   and `materials` (authenticated) exist — created by `003_storage.sql`.
   Upload wiring from the API is still a TODO; buckets alone do not upload.
6. Copy the connection string: **Project Settings → Database → Connection
   string (URI)**. Use the **pooler** URI if offered (port 6543) for Render's
   free tier. This is `DATABASE_URL` below — treat it as a secret.

## 2. Render — backend API

1. Push this repo to GitHub (owner's decision; this local build pushes nothing).
2. Render Dashboard → **New → Web Service** → connect the repo.
3. Settings:
   - **Root Directory:** `bbc-fullstack/backend` (or the repo root if this
     folder IS the repo root — adjust paths accordingly; `render.yaml` at the
     `bbc-fullstack/` level already declares `rootDir: backend`).
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Plan:** Free to start. Free-tier notes: the service sleeps after
     inactivity (first request after sleep is slow), and it has no persistent
     disk — that is fine because all data lives in Supabase, never on disk.
4. **Environment variables** (Render → Environment):
   - `NODE_ENV=production`
   - `JWT_SECRET=` — generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Required; the server refuses to start in production without it.
   - `DATABASE_URL=` — the Supabase URI from step 1.6.
   - `CORS_ORIGIN=` — your Cloudflare Pages URL(s), comma-separated, e.g. `https://bbc-academy.pages.dev` (add the custom domain later too).
   - `SEED_DEMO=false` — so demo accounts are NOT created in production.
   - `ADMIN_SETUP_KEY=` — optional, only if you want API admin registration.
   - `ACADEMY_TIMEZONE=` — optional, IANA zone used for default dates such as
     attendance (default `Asia/Gaza`). Set it only if the academy is elsewhere.
5. Deploy, then verify: open `https://bbc-academy-fullstack.onrender.com/api/health`
   — expect `{ "status": "ok", "store": "postgres", ... }`. If `store` says
   `memory`, `DATABASE_URL` is not set — fix it before going live.

## 3. Cloudflare Pages — frontend

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
   → pick the repo.
2. Settings:
   - **Framework preset:** None
   - **Root directory:** `bbc-fullstack/frontend` (or repo root if applicable)
   - **Build command:** `node build.js`
   - **Build output directory:** `.` (the frontend folder itself — the files
     are already static; `build.js` only rewrites `config.js`)
   - **Environment variable:** `API_BASE_URL=https://bbc-academy-fullstack.onrender.com`
     (no trailing slash).
3. Deploy. Open the Pages URL: the yellow DEMO MODE banner must be **gone**
   (it appears only when no backend answers). Log in with a real account
   created in step 1.4.
4. **Custom domain** (only after the owner confirms the domain):
   - Pages → **Custom domains → Set up a custom domain** → enter the domain →
     follow the DNS instructions Cloudflare shows (usually a CNAME to
     `<project>.pages.dev`, or Cloudflare nameservers if the domain is moved
     to Cloudflare).
   - Then add the custom domain to Render's `CORS_ORIGIN` and redeploy the
     backend, or API calls from the custom domain will be CORS-blocked.
   - Wait for DNS + the certificate to show **Active** before announcing it.

## 4. Smoke checks after deploy

```bash
curl https://bbc-academy-fullstack.onrender.com/api/health
curl https://bbc-academy-fullstack.onrender.com/api/courses
curl https://bbc-academy.pages.dev/            # 200, connected mode (no demo behaviour)
```

## Rollback

- Frontend: redeploy a previous Pages deployment (Pages → Deployments).
- Backend: redeploy a previous Render deploy; data is untouched (it lives in
  Supabase, not on Render).
- Database: migrations are additive (`IF NOT EXISTS` / `ON CONFLICT DO
  NOTHING`); there is no automatic down-migration — restore from a Supabase
  backup if a migration must be undone.
