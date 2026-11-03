# Master dashboard review — working note (local work, not deployed)

This note records the audit behind the authenticated-dashboard rework
(grouped sidebar shell, Admin / Teacher / Student workspaces) so a reviewer
can check it without re-reading every file. No production change was made
from this work; nothing here was applied to Supabase, Render, or Pages.

## Feature / API map (what each workspace actually uses)

| Workspace | Data shown | Source endpoint(s) | Notes |
|---|---|---|---|
| Admin Overview | students, teachers, courses, pending bookings, enrolments; needs-attention (pending bookings, courses without a teacher); recent bookings | `/api/admin/users`, `/api/courses?all=1`, `/api/admin/booking-requests`, `/api/enrolments` | All counts are real counts from these calls. No trends, no charts. |
| Admin People / Students | users list, role filter, search by name/email/username; create student/teacher; role change; password reset; delete (never self) | `/api/admin/users` GET/POST/PUT/DELETE | Passwords are never displayed; reset is an input the admin types, never a shown value. |
| Admin Courses & teachers | create course (title_en, title_ar, slug, level_id, weeks, teacher_id, published), assign/reassign teacher, delete | `/api/courses` POST/PUT/DELETE, `/api/levels` | Only backend-supported fields are offered. `price_amount` is always stored NULL by design (owner decision pending). |
| Admin Admissions | booking tabs pending/confirmed/rejected; confirm/reject; create student from a booking; delete booking | `/api/admin/booking-requests` GET/PUT/DELETE | "Create account" is offered only for pending/confirmed bookings, never rejected ones. Duplicate accounts are avoided only where data permits (same email is rejected by the backend with 409). |
| Admin Operations | levels list; lesson/assignment/submission/attendance counts; announcements list + publish form | `/api/levels`, `/api/lessons`, `/api/assignments`, `/api/submissions`, `/api/attendance`, `/api/announcements` | Read lists plus the existing publish-announcement endpoint. No new write actions were invented here. |
| Admin Reports | counts only (students, teachers, courses, enrolments; booking and enrolment status breakdowns) | Same admin fetches as Overview | No charts, no downloads, no fabricated figures. |
| Teacher Overview | my courses, deduplicated my students (scoped to own courses), ungraded submissions (own courses) | `/api/courses?all=1` (teacher sees own), `/api/enrolments` (server-scoped), `/api/submissions` (server-scoped) | Scoping is enforced server-side; the UI only displays what the server returned. |
| Teacher Teaching | my classes, my students roster, lessons, assignments | `/api/courses?all=1`, `/api/enrolments`, `/api/lessons`, `/api/assignments` | Lesson/assignment creation uses the existing ownership-checked endpoints. |
| Teacher Assessment | submissions with pending/graded filter; grade 0–100 with inline validation; feedback; save updates only that row | `/api/submissions`, `/api/submissions/:id/grade` | Grading is ownership-checked server-side (`canManageCourse`). |
| Teacher Attendance | own-course select, only its enrolled students, date + statuses present/absent/late/excused, recent history | `/api/attendance` POST/GET (server-scoped) | See the known gap below. |
| Teacher Communication | announcements list + publish form (audience all/students/teachers) | `/api/announcements` | Audience options match the backend enum. |
| Student Overview | enrolled courses, CEFR/recommended level from latest placement, attendance present/total, recent grades, Continue-learning, Next-steps | `/api/enrolments/me`, `/api/placement-tests/me`, `/api/attendance/me`, `/api/assignments` (scoped) | Next-steps links go to real pages/views only. No percentage progress bars (no reliable completion data exists). |
| Student My courses | enrolled courses with level, status, lesson/assignment counts, Open-course link | Same student fetches + `/api/lessons`, `/api/assignments` | Level shown is the course `level_id` value; if levels are not fetched here it shows the raw id — see limitation below. |
| Student My work | homework split pending/submitted/graded; submission form; grade + feedback only when returned | `/api/assignments`, `/api/submissions` (student-scoped) | One submission per assignment; a revision clears the grade (backend rule, preserved). |
| Student My progress | latest placement result, attendance present/total with the calculation explained in words, returned grades | `/api/placement-tests/me`, `/api/attendance/me`, `/api/assignments` | Attendance counts present records out of all recorded days; late/excused are not counted as present. |
| All roles: Account | password change via existing endpoint, language, logout | `/api/profile/password` | Logout clears `bbc-token`/`bbc-user` and returns to `index.html`. |

## Broken / inconsistent flows found and fixed

1. Dashboard `section()`/`overview()` misuse (raw tags + `undefined`) — fixed in
   an earlier commit; this work did not reintroduce it.
2. `window.confirm()` / `alert()` as the primary feedback pattern in dashboard
   handlers — replaced with an accessible dialog + toasts. `alert()` no longer
   appears in `frontend/dashboard.js`.
3. Mutations that forced a full-page reload — replaced with in-place refresh
   (`refreshCurrent()`), except the language switch, which still reloads
   (hash and login survive; unsaved form input is lost — see limitations).
4. "Create account" offered for rejected bookings — now offered only for
   pending/confirmed bookings.
5. Admin Courses view showed nothing when the course list was empty — a create
   course form now exists in the same view (earlier commit), and this work
   adds the unassigned-teacher needs-attention item on Overview.
6. No dedicated Students section for the admin — added earlier; this work
   adds search to it and to People.
7. Teacher had no My-students roster view — added (deduplicated, own courses).
8. Student had no Progress view or course-detail view — added (placement,
   attendance with explanation, returned grades; courses with counts).

## Gaps documented, not faked

- **Attendance enrolment gap (backend, unchanged):** `POST /api/attendance`
  checks course ownership and that the student exists with role student, but
  does NOT verify the student is enrolled in that course. The teacher UI only
  offers enrolled students, so this is reachable only by a direct API call.
  It was deliberately NOT changed here because the existing backend test
  marks attendance for a non-enrolled student and would break; fixing it
  requires updating that test and the endpoint together. Owner decision.
- **Course level display (student):** the student courses table shows the
  course `level_id` raw value. Mapping it to a CEFR code/name requires the
  public levels list in the student render; not added because it would be
  another fetch and the raw value is at least honest. Minor polish item.
- **Payments:** `/api/payments` is a placeholder (status pending, provider
  placeholder, no money moves). The dashboards do not surface payments at
  all; do not claim payments work.
- **Live classes:** a link field only (`live_class_url`); no built-in video.
  Student lessons show a Join button only when a URL exists.
- **Email / certificates / file upload:** not configured; nothing in the
  dashboards claims they are.
- **Prices:** course `price_amount` is stored NULL by design. The public FAQ
  says fees are on enquiry. Any real pricing needs an owner decision.
- **Language switch:** reloads the page (hash preserved, login preserved).
  Unsaved form input is lost. Improving this to a no-reload re-render is a
  follow-up, not a regression: this was the pre-existing behaviour.
- **Language persistence:** `localStorage` key `bbc-lang`, as before.

## Backend / schema changes in this work

None. No endpoint added, changed, or removed; no migration file added.
`db/migrations/` is untouched. The backend was only run locally for tests.

## Deployment order (if this work is ever approved for production)

1. No migration to apply.
2. Deploy the frontend only (Pages rebuild from the repo, as usual).
3. No Render environment change is needed by this work.
4. Verify after deploy: admin/teacher/student login, sidebar navigation at
   phone and desktop widths, one create + one delete per role, and the
   grading save without a full reload.
