# API Reference — BBC English Academy

Base URL: local `http://localhost:4000`, production = your Render URL.
All bodies are JSON. Auth: `Authorization: Bearer <JWT>` unless marked Public.
Errors: `{ "error": "<message>" }` with an HTTP status.

## Health (Public)

| Method | Endpoint | Response |
|---|---|---|
| GET | `/api/health` | `{ status: "ok", store: "memory" \| "postgres", time }` |

## Auth

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/auth/register` | Gated: header `x-admin-setup-key` must match `ADMIN_SETUP_KEY` (20/hour per IP) | `{ email, password (≥8), full_name, username? (3-30 chars: letters, digits, `_` or `.`), role?: "student" }` — without the key the endpoint is closed (students never self-register; an admin creates accounts, see `/api/admin/users`). `role: "admin"` needs the same key; `role: "teacher"` is rejected (teachers must be created by an admin); duplicate email or username → 409 | 201 `{ user, token }` |
| POST | `/api/auth/login` | Public | `{ email, password }` **or** `{ username, password }` — an identifier without `@` is treated as a username; wrong identifier/password → generic 401 | `{ user, token }` |
| GET | `/api/auth/me` | Any role | — | `{ user }` |

`user` never includes `password_hash`.

## Profile

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/profile/me` | Any role | — | `{ user }` |
| PUT | `/api/profile/me` | Any role | `{ full_name?, phone? }` | `{ user }` |
| POST | `/api/profile/password` | Any role | `{ current_password, new_password (≥8) }` — wrong `current_password` → 401. Existing tokens stay valid until they expire, the new password applies to the next login | `{ updated: true }` |

## Levels & Courses

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/levels` | Public | — | `{ levels: [...] }` |
| GET | `/api/courses` | Public | — | `{ courses: [...] }` |
| GET | `/api/courses/:id` | Public | id = uuid or slug | `{ course }` |
| POST | `/api/courses` | teacher, admin | `{ slug, title_en, title_ar?, description_en?, description_ar?, duration_weeks?, level_id?, teacher_id? }` — `price_amount` is always stored NULL (TODO for owner) | 201 `{ course }` |
| PUT | `/api/courses/:id` | teacher, admin | partial course fields (price ignored). A teacher may only edit a course they teach (403 otherwise); `teacher_id` is admin-only (a teacher sending it gets 403) | `{ course }` |
| DELETE | `/api/courses/:id` | admin | — | `{ deleted: true }` |

## Lessons

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/lessons?course_id=` | Logged in | — | `{ lessons: [...] }` (scoped: students see enrolled courses, teachers own courses, admins all) |
| POST | `/api/lessons` | teacher, admin | `{ course_id, title_en, title_ar?, content_url?, material_url?, live_class_url?, order_no? }` — `live_class_url` is just a meeting link, no built-in video | 201 `{ lesson }` |

## Enrolments

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/enrolments` | student, admin | `{ course_id }` for a student (status `pending`, self only — 403 if `student_id` differs); admin may pass `student_id` (must exist, 404 otherwise) and the enrolment is created `active` | 201 `{ enrolment }` |
| GET | `/api/enrolments/me` | Any role | — | `{ enrolments: [...] }` |
| GET | `/api/enrolments` | teacher, admin | — | admin: all; teacher: only enrolments for courses they teach (`courses.teacher_id = teacher id`), filtered server-side; enrolments include `student_name` | `{ enrolments: [...] }` |
| DELETE | `/api/enrolments/:id` | admin | — | `{ deleted: true }` |
| PUT | `/api/enrolments/:id` | admin | `{ status: "pending" \| "active" \| "completed" \| "cancelled" }` — approves a pending enrolment (or changes its status) | `{ enrolment }` |

## Placement tests

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/placement-tests` | Any role | `{ answers: [20 numbers, each 0-2] }` — server re-scores; bands: <25% A1, <45% A2, <65% B1, <85% B2, <95% C1, else C2 | 201 `{ result: { score, total, recommended_level } }` |
| GET | `/api/placement-tests/me` | Any role | — | `{ results: [...] }` |

## Assignments, submissions, grades

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/assignments` | teacher, admin | `{ course_id, title, description?, due_date?, questions?, file? }` — `questions` builds the homework (max 30), `file` attaches an uploaded one; either may be omitted for a plain written-answer task | 201 `{ assignment }` (`has_file: true` when a file was stored) |
| GET | `/api/assignments?course_id=` | Logged in | — | `{ assignments: [...] }` (scoped by role). Students receive the questions **without** `correct` / `answers` |
| GET | `/api/assignment-files/:assignmentId` | assignment's teacher, admin, or a student enrolled in its course | — | the raw file (`Content-Type`, `Content-Disposition`, `Cache-Control: private, no-store`); 403 for anyone else |
| POST | `/api/submissions` | student | `{ assignment_id, answers }` for question homework, else `{ assignment_id, content_text? , content_url? }` (at least one required) | 201 `{ submission }` on the first answer, 200 when the student revises it — one submission per assignment per student, and revising clears the old grade. Question homework is auto-marked (`auto_score` / `auto_total`); the teacher still sets the final `grade` |
| GET | `/api/submissions?assignment_id=` | teacher, admin | — | `{ submissions: [...] }` |
| POST | `/api/submissions/:id/grade` | teacher, admin | `{ grade: 0-100, feedback? }` | `{ submission }` (also mirrored to `grades`) |

### Homework questions

`questions` is an ordered array (max 30); each one is
`{ type, prompt, ... }` with `type` one of:

| `type` | Extra fields | Marking |
|---|---|---|
| `multiple_choice` | `options` (2-6 strings), `correct` (index) | automatic |
| `fill_blank` | `answers` (accepted strings, 1-6) | automatic, ignores case/spacing/punctuation |
| `translate` | `answers` (accepted translations, 1-6) | automatic, same matching rules |
| `short_answer` | — | the teacher marks it |

The API assigns `id` (`q1`, `q2`, …) and returns questions to students without
`correct` / `answers`. A student submits
`{ assignment_id, answers: [{ question_id, answer }] }`; the server marks the
objective questions and stores `auto_score` / `auto_total` plus a readable
summary in `content_text` (so the existing grading screen still shows the work).

### Homework files

`file` is `{ name, data }` where `data` is base64 (no `data:` prefix). Only PDF,
PNG, JPEG and WebP are accepted — the type is decided by the file's magic bytes,
not its name or declared type — and the limit is 2 MB. The bytes live in
`assignment_files` (migration 008) and are only readable through
`/api/assignment-files/:id`, so there is no public URL. The frontend fetches the
file with its Bearer token and saves it as a local blob.

## Attendance & announcements

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/attendance` | teacher, admin | `{ course_id, student_id, lesson_id?, status: "present" \| "absent" \| "late" \| "excused", attended_on? }` — `attended_on` is `YYYY-MM-DD`; when omitted it defaults to **today in `ACADEMY_TIMEZONE`** (default `Asia/Gaza`), not the server's UTC date | 201 `{ attendance }` |
| GET | `/api/attendance?course_id=` | teacher, admin | — | `{ attendance: [...] }` |
| GET | `/api/me/attendance` | Any role | — | `{ attendance: [...] }` (student-only) |
| POST | `/api/announcements` | teacher, admin | `{ title, body, audience? }` | 201 `{ announcement }` |
| GET | `/api/announcements` | Public | — | `{ announcements: [...] }` |

## Payments — PLACEHOLDER ONLY

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/payments` | Any role | `{ course_id?, amount?, currency? }` | 201 `{ payment, note }` — status `pending`, provider `placeholder`. **No provider is connected and no money moves.** |
| GET | `/api/payments/me` | Any role | — | `{ payments: [...] }` |
| GET | `/api/payments` | admin | — | `{ payments: [...] }` |

## Booking requests (anonymous — students apply BEFORE having an account)

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/booking-requests` | Public | `{ full_name, email?, phone?, course?, source?, message? }` — the email field is required for the admin to create the account and contact the applicant | 201 `{ booking_request }` (status `pending`) |
| GET | `/api/admin/booking-requests` | admin | — | `{ booking_requests: [...] }` |
| PUT | `/api/admin/booking-requests/:id` | admin | `{ status: "pending" \| "confirmed" \| "rejected" }` | `{ booking_request }` |

The admin confirms a request, then creates the student account — students never self-register.

## Admin

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/users` | admin | — | `{ users: [...] }` (no password hashes; includes `username`) |
| POST | `/api/admin/users` | admin | `{ email, password (≥8), full_name, role: "student" \| "teacher" \| "staff" \| "admin", username? }` | 201 `{ user }` |
| PUT | `/api/admin/users/:id` | admin | `{ full_name?, phone?, role?, password? (≥8, resets the password), username? (null clears it) }` — an admin cannot remove their own admin role | `{ user }` |
| POST | `/api/admin/enrolments` | admin | `{ student_id, course_id, status?: "pending" \| "active" \| "completed" \| "cancelled" }` | 201 `{ enrolment }` |

## Staff — student records

A staff account runs student records: creating and editing students, their
usernames, passwords and course enrolments. Teachers, courses, bookings and
other accounts stay with the admin. Every route below accepts `staff` or
`admin`; a student or teacher gets 403.

| Method | Endpoint | Body | Response |
|---|---|---|---|
| GET | `/api/staff/students` | — | `{ students: [...], courses: [...] }` — each student carries `enrolments` (with course titles) and submission counts |
| GET | `/api/staff/students/:id` | — | `{ student, courses, enrolments, attendance, submissions }` (read-only activity) |
| POST | `/api/staff/students` | `{ full_name, email, password (≥8), username?, phone?, course_id?, status? }` | 201 `{ student, enrolment }` — the role is always `student` |
| PUT | `/api/staff/students/:id` | `{ full_name?, username? (null clears it), email?, phone? }` — role and password are not editable here | `{ student }` |
| POST | `/api/staff/students/:id/password` | `{ password (≥8) }` | `{ updated: true }` |
| POST | `/api/staff/students/:id/enrolments` | `{ course_id, status?: "pending" \| "active" \| "completed" \| "cancelled" }` — an existing enrolment is updated instead of duplicated | 201 `{ enrolment }` |
| PUT | `/api/staff/students/:id/enrolments/:enrolmentId` | `{ status }` | `{ enrolment }` |
| DELETE | `/api/staff/students/:id/enrolments/:enrolmentId` | — | `{ deleted: true }` |
| DELETE | `/api/staff/students/:id` | — | `{ deleted: true }` (account, enrolments and work) |

> Staff accounts are created by an admin (`POST /api/admin/users` with
> `role: "staff"`), and the role needs `db/migrations/009_staff_role.sql`.

## Migrations

`db/migrations/005_usernames.sql` adds `profiles.username` (nullable) plus a
unique index on it (many NULLs allowed, so existing users are unaffected).

**Deployment order — migrations FIRST, code second:** run
`005_usernames.sql` (and `005_fixes.sql` if it is not applied yet) in the
Supabase SQL Editor and confirm they succeed *before* deploying code that
writes `username` or `booking_requests.email`. Otherwise those writes fail on
Postgres with a missing-column 500.

The admin confirms a booking request and creates the student account here — students never self-register.

## Demo accounts (local backend only, `SEED_DEMO`)

`student@demo.local`, `teacher@demo.local`, `staff@demo.local`, `admin@demo.local` — all with
password `Demo1234!`. Demo seeding is ON by default when `NODE_ENV` is not
`production`, and OFF in production unless you set `SEED_DEMO=true`. See
`docs/DEPLOY.md`.
