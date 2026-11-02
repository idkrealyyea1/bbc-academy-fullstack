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
| POST | `/api/auth/register` | Public | `{ email, password (≥8), full_name, role?: "student" \| "teacher" }` — `role: "admin"` needs header `x-admin-setup-key` matching `ADMIN_SETUP_KEY` | 201 `{ user, token }` |
| POST | `/api/auth/login` | Public | `{ email, password }` | `{ user, token }` |
| GET | `/api/auth/me` | Any role | — | `{ user }` |

`user` never includes `password_hash`.

## Profile

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/profile/me` | Any role | — | `{ user }` |
| PUT | `/api/profile/me` | Any role | `{ full_name?, phone? }` | `{ user }` |

## Levels & Courses

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/levels` | Public | — | `{ levels: [...] }` |
| GET | `/api/courses` | Public | — | `{ courses: [...] }` |
| GET | `/api/courses/:id` | Public | id = uuid or slug | `{ course }` |
| POST | `/api/courses` | teacher, admin | `{ slug, title_en, title_ar?, description_en?, description_ar?, duration_weeks?, level_id?, teacher_id? }` — `price_amount` is always stored NULL (TODO for owner) | 201 `{ course }` |
| PUT | `/api/courses/:id` | teacher, admin | partial course fields (price ignored) | `{ course }` |
| DELETE | `/api/courses/:id` | admin | — | `{ deleted: true }` |

## Lessons

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/lessons?course_id=` | Public | — | `{ lessons: [...] }` |
| POST | `/api/lessons` | teacher, admin | `{ course_id, title_en, title_ar?, content_url?, material_url?, live_class_url?, order_no? }` — `live_class_url` is just a meeting link, no built-in video | 201 `{ lesson }` |

## Enrolments

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/enrolments` | student, admin | `{ course_id }` | 201 `{ enrolment }` (status `pending`) |
| GET | `/api/enrolments/me` | Any role | — | `{ enrolments: [...] }` |
| GET | `/api/enrolments` | teacher, admin | — | `{ enrolments: [...] }` |

## Placement tests

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/placement-tests` | Any role | `{ answers: [20 numbers, each 0-2] }` — server re-scores; bands: <25% A1, <45% A2, <65% B1, <85% B2, <95% C1, else C2 | 201 `{ result: { score, total, recommended_level } }` |
| GET | `/api/placement-tests/me` | Any role | — | `{ results: [...] }` |

## Assignments, submissions, grades

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/assignments` | teacher, admin | `{ course_id, title, description?, due_date? }` | 201 `{ assignment }` |
| GET | `/api/assignments?course_id=` | Public | — | `{ assignments: [...] }` |
| POST | `/api/submissions` | student | `{ assignment_id, content_text? , content_url? }` (at least one required) | 201 `{ submission }` |
| GET | `/api/submissions?assignment_id=` | teacher, admin | — | `{ submissions: [...] }` |
| POST | `/api/submissions/:id/grade` | teacher, admin | `{ grade: 0-100, feedback? }` | `{ submission }` (also mirrored to `grades`) |

## Attendance & announcements

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/attendance` | teacher, admin | `{ course_id, student_id, lesson_id?, status: "present" \| "absent" \| "late" \| "excused", attended_on? }` | 201 `{ attendance }` |
| GET | `/api/attendance?course_id=` | teacher, admin | — | `{ attendance: [...] }` |
| POST | `/api/announcements` | teacher, admin | `{ title, body, audience? }` | 201 `{ announcement }` |
| GET | `/api/announcements` | Public | — | `{ announcements: [...] }` |

## Payments — PLACEHOLDER ONLY

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| POST | `/api/payments` | Any role | `{ course_id?, amount?, currency? }` | 201 `{ payment, note }` — status `pending`, provider `placeholder`. **No provider is connected and no money moves.** |
| GET | `/api/payments/me` | Any role | — | `{ payments: [...] }` |
| GET | `/api/payments` | admin | — | `{ payments: [...] }` |

## Admin

| Method | Endpoint | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/admin/users` | admin | — | `{ users: [...] }` (no password hashes) |

## Demo accounts (local backend only, `SEED_DEMO=true`)

`student@demo.local`, `teacher@demo.local`, `admin@demo.local` — all with
password `Demo1234!`. Change/disable seeding (`SEED_DEMO=false`) in production.
