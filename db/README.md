# Database — Supabase-ready PostgreSQL

Apply in the Supabase SQL Editor, in order. Do NOT run `seed.sql` on a
production project until the owner has confirmed the demo content is wanted.

1. `migrations/001_init.sql` — tables, enums, foreign keys, indexes.
2. `migrations/002_rls.sql` — Row Level Security + policies.
3. `migrations/003_storage.sql` — Storage buckets for avatars/materials (optional).
4. `migrations/004_booking_requests.sql` — anonymous booking requests.
5. `migrations/005_fixes.sql` — `booking_requests.email`, one grade row per
   submission. **Required** by the current API: booking requests send an email
   and grading upserts into `grades`.
6. `migrations/005_usernames.sql` — `profiles.username` + unique index (teacher/student login by username).
7. `migrations/006_levels.sql` — the six CEFR levels (reference data, NOT demo content). Required: the "add course" form matches a level by `name_en`, so an empty `levels` table files every course under NULL and shows it as Beginner. Idempotent, safe to re-run on production.
8. `../supabase/seed.sql` — demo levels/courses/teachers/lessons only. All
   prices are NULL on purpose (TODO for the owner); teacher rows are labelled
   DEMO and must be replaced with real staff.

## Supabase Auth note

The API in `backend/` issues its own JWTs and uses `profiles.id` as the user
id. If you later switch the API to Supabase Auth, create `profiles` rows with
`id = auth.users.id` (see the comment at the top of `001_init.sql`) and keep
the same column names — the API's Postgres store already reads/writes these
tables. Do not store passwords anywhere except `password_hash` (bcrypt).

## Local Postgres (optional)

```bash
createdb bbc_academy
psql bbc_academy < db/migrations/001_init.sql
psql bbc_academy < db/migrations/002_rls.sql
psql bbc_academy < db/migrations/003_storage.sql
psql bbc_academy < db/migrations/004_booking_requests.sql
psql bbc_academy < db/migrations/005_fixes.sql
psql bbc_academy < db/supabase/seed.sql
DATABASE_URL=postgres://localhost:5432/bbc_academy npm --prefix backend start
```

Without `DATABASE_URL` the backend uses an in-memory store instead — see
`backend/src/db.js`. That is for smoke tests only.
