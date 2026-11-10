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
7. `migrations/006_levels.sql` — the six CEFR levels (reference data, NOT demo content). Required: the "add course" form matches a level by `name_en`, so an empty `levels` table files every course under NULL: no level tag is shown and no level filter matches it. Idempotent, safe to re-run on production.
8. `migrations/007_submissions_unique.sql` — one submission per (assignment, student). The API upserts, so this index is what makes a student revising homework edit their answer instead of creating a second one. **Required** by the current API: the submission insert uses `ON CONFLICT` on exactly this key.
9. `migrations/008_homework_questions.sql` — homework a teacher builds
   (`assignments.questions`) or uploads (`assignment_files`), plus
   `submissions.answers` / `auto_score` / `auto_total`. **Required** by the
   current API: the assignment insert writes `questions`, and submissions write
   answers. Files are stored in Postgres and served only by the authenticated
   API, so no public bucket is involved.
10. `migrations/009_staff_role.sql` — the `staff` role used by the student
    records dashboard (adds students, usernames, passwords, enrolments).
    **Required** before creating a staff account: the `profiles.role` enum has
    no `staff` value until this runs.
11. `migrations/010_homework_lessons_late.sql` — `assignments.lesson_id`
    (nullable, `ON DELETE SET NULL` so a lesson can be removed without losing
    the homework) and `submissions.submitted_late`. **Required** by the current
    API: homework create/edit writes `lesson_id` and submissions write
    `submitted_late`. Homework with no lesson still shows on a lesson page
    under "Other homework for this course".
12. `../supabase/seed.sql` — demo levels/courses/teachers/lessons only. All
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
psql bbc_academy < db/migrations/006_levels.sql
psql bbc_academy < db/migrations/007_submissions_unique.sql
psql bbc_academy < db/migrations/008_homework_questions.sql
psql bbc_academy < db/migrations/009_staff_role.sql
psql bbc_academy < db/migrations/010_homework_lessons_late.sql
psql bbc_academy < db/supabase/seed.sql
DATABASE_URL=postgres://localhost:5432/bbc_academy npm --prefix backend start
```

Without `DATABASE_URL` the backend uses an in-memory store instead — see
`backend/src/db.js`. That is for smoke tests only.
