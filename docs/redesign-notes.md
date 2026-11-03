# Dashboard redesign notes (Worker B — frontend redesign)

Base: commit `8f121df`. Scope: `frontend/dashboard-*.html`,
`frontend/dashboard.css`, `frontend/dashboard.js` only. No backend, API,
public-page, `config.js`, or other-worker changes. Not committed, pushed,
or deployed; no live service was contacted (all verification against a
local memory-store backend on `:4000` and a local static server on `:8000`).

## Design direction

Calm navy/paper academy workspace, red reserved for primary actions and
active states. One shell, three distinct workspaces: admin leads with
"needs attention" and quick actions; teacher leads with pending grading;
student leads with next steps. Phone-first: 16px side padding, 2-column
metric grids with a deliberate full-width last card, grouped forms, and
tables that become labelled stacked cards under 640px.

## What changed

- **Design system (`dashboard.css`, rewritten):** centralised tokens
  (colours, type, spacing, radii, shadows, content width 1080px,
  breakpoints, focus rings, 48px control height), system-first font stack
  (no new external font), logical properties throughout, safe-area
  insets, reduced-motion support. The public stylesheets' 96px/72px
  `main.wrap` top padding is overridden in dashboard scope.
- **Shell:** proportionate desktop sidebar (248px, sticky) + content
  max-width; mobile off-canvas drawer with backdrop, close button,
  Escape/backdrop/navigation close, `aria-expanded`/`aria-controls`,
  focus into the drawer on open and back to the menu button on close,
  `aria-current="page"` on the active nav item. Nav group titles changed
  from `h3` to `p` so the heading order is shell `h1` → view `h2` →
  card `h2`; the per-view title is visually hidden (the titlebar shows
  it once) and navigation focuses the titlebar `h1`.
- **Metrics / quick actions:** new `.dash-metric` component; phone and
  tablet use 2 equal columns with an odd last card spanning full width
  (verified geometry at 390px: 173px + 173px, last 358px); desktop uses
  balanced auto-fit columns. Quick actions are a responsive grid with
  the primary action red and the rest quiet; destructive row actions
  are visually separated (red text/border).
- **Admin:** overview keeps real counts only; quick-action grid;
  courses table now shows title, readable level, duration, teacher,
  published status badge, and actions. Course creation is grouped into
  four fieldsets (information / level+duration / teacher / visibility)
  with `for`/`id` labels, required/optional marks, slug helper text,
  readable level names, teacher names, and a proper accessible switch
  (no giant checkmark button). Enrolment statuses use translated badges.
- **Teacher:** overview adds a "Needs attention" card (ungraded count
  with a link to grading, or an honest nothing-pending state); classes
  table adds a readable level column; attendance student list starts
  filtered to the first assigned course's enrolled students.
- **Student:** the raw `level_id` limitation is fixed — courses,
  placement level, and progress now show the mapped readable level
  (e.g. "A1 — Beginner" / "A1 — مبتدئ") from `/api/levels`, never an
  invented level; unknown levels render "—". Course rows with an
  unknown course no longer expose a raw course id.
- **Account (all roles):** profile card (name, email, role) plus a
  password form with separate labels, an 8+ character helper, a
  confirm field with inline mismatch validation, inline success/error
  states, values preserved on error, and submit disabled while pending.
- **Tables / empty states:** `labelTableCells()` copies header text to
  `data-label` on every cell; under 640px rows become labelled cards
  (key fields first, full-width 44px+ actions) and the outer card
  dissolves so there is no card-in-card nesting; empty tables render a
  dashed empty state instead of a bare muted line.
- **Interaction (bug fixes found by testing):**
  - `refreshCurrent()` now awaits the render before re-adding the
    account view and showing the current view. Previously it called
    the async render without awaiting, so after every save the fresh
    views stayed `hidden` (blank dashboard) and the account view was
    wiped until the next navigation.
  - Course and teacher creation now also show a toast on success: the
    old inline success div was destroyed by the rerender that followed
    it, so success feedback was silently lost.
  - Every async form now disables its submit button while pending
    (attendance, announcement, assignment, lesson, enrolment, teacher
    creation, course creation, student account creation, account
    password; grading and homework submission already did).
  - Status badges now show translated text plus colour, never colour
    alone; known statuses are mapped EN/AR.

## Preserved

All 8f121df behaviours: grouped role-aware sidebar/drawer, hash routing,
toasts/dialogs (no `alert`/`confirm`), no-reload mutations, search /
filters / tabs, add/delete flows, API contracts, auth flows, role
checks, bilingual AR/EN + RTL/LTR, and public pages. No invented data;
payments/video/certificates/file-upload/email remain unclaimed
placeholders exactly as before. Two table inputs keep intentional inline
widths (grade 80px, people password 150px); phone card mode overrides
them to full width.

## Verification (local only, Playwright + Chromium)

52/52 automated checks passed on the final run: real login per role;
admin create + delete course (incl. validation blocking an empty
submit, slug auto-fill, exactly 1 POST on a double-click with the
button disabled while pending); admin create + delete teacher; admin
create student account; teacher create assignment; student submit
homework; teacher grade save without reload (badge flips to Graded,
URL unchanged) and grade-101 validation preserving typed values;
teacher attendance save with toast and enrolled-only student list;
account password mismatch inline error, then success, then API login
with the new password; drawer open/scrim/Escape + focus return;
hash nav + back/forward + deep-link refresh; language switch keeping
login + hash and flipping `dir`; zero page overflow at 320, 360, 390,
768, 1024, 1440 in both AR and EN; `node --check` on `dashboard.js`;
backend `npm test` 18/18 (backend untouched by this worker).
Screenshots inspected: admin overview 390 AR, admin drawer 390 AR,
admin courses form + stacked cards 390 EN, admin overview 1440 EN,
delete dialog 390 AR. Two screenshot findings were fixed in this pass:
quiet buttons were invisible in AR (public stylesheet's `!important`
white button text) and the dialog Cancel button likewise; both now
use scoped `!important` navy text, and destructive actions use scoped
`!important` red text.

## Not verified / known limits

- No real-device test (headless Chromium only); touch behaviour is
  inferred from 44px+ targets and layout, not a physical phone tap.
- The sandbox cannot reach Google Fonts (tunnel failure), so screenshots
  render with system fonts; the dashboard's system-first stack makes
  this a non-issue by design, but the exact public font rendering was
  not observed.
- Backend/security items from the brief (attendance enrolment
  validation, regression tests, RLS review) belong to another worker
  and were not touched here; the frontend still only offers enrolled
  students in the attendance picker, which is not authorization.
- Teacher/student/parent flows beyond the exercised paths (e.g.
  lessons list with a live-class link, announcements list rendering)
  were rendered but not click-tested end to end.
