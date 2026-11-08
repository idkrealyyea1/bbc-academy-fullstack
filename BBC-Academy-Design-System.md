# BBC English Academy — Design System

The site uses one warm-editorial system for every page: public pages, the
placement quiz, the booking and contact forms, the student login and the
student / teacher / admin dashboards. Nothing about the stack changed — it is
still vanilla HTML/CSS/JS on the existing Express API, with no framework, no
build step and no API contract changes.

The art direction follows the **Warm Editorial** brief from the OpenDesign
design-system catalogue (`design-systems/warm-editorial`): paper and ink,
hairline structure, one oxblood accent, a serif voice, no gradients and
near-zero shadow. Craft rules from the same catalogue (typography hierarchy,
colour restraint, anti-AI-slop, RTL, state coverage) were applied while
retuning the components.

## Palette

```css
--background: #fbf8f3;      /* paper */
--background-soft: #f4efe6; /* sand, for bands and insets */
--surface: #ffffff;
--surface-inset: #f7f2e9;
--text: #1b1917;            /* ink */
--text-secondary: #4b453e;
--text-muted: #71685e;
--primary: #8a1c26;         /* oxblood */
--primary-hover: #6f141d;
--accent: #8a1c26;
--border: rgba(27, 25, 23, 0.13);
```

Radii stay modest (3 / 6 / 10 / 16 px), shadows are warm and very low
opacity, and the only "tint" in the UI is the oxblood accent used for
eyebrows, active states, links and the primary button.

## Type

| Role | Latin | Arabic |
| --- | --- | --- |
| UI / body | Manrope 400–700 | IBM Plex Sans Arabic 400–700 |
| Display / editorial | Lora 500 (+ italic) | Noto Naskh Arabic 400–700 |

All four faces are self-hosted subsets in `frontend/assets/fonts/` — no
external font requests. Lora replaced Playfair Display: at display sizes
Playfair's `t` and `th` drew a crossbar that read as a strikethrough. Arabic
headings use Noto Naskh so RTL keeps serif-quality display type instead of
falling back to the body sans.

## Files

- `frontend/system.css` — tokens, base type, layout primitives, shared
  components (buttons, fields, cards, panels, badges, alerts, table, topbar,
  mobile drawer, footer, skeleton, media, page transition hooks).
- `frontend/public.css` — public-page compositions only (hero, trust strip,
  paths, method, teaching, story, CEFR rail, enrol, catalogue, course detail,
  levels/quiz, FAQ, journal, booking, contact, auth).
- `frontend/home.css` — the homepage cover: oversized display headline, photo
  plate with a white caption bar, hairline trust strip, varied section rhythm.
- `frontend/dashboard.css` — the shared application shell for all three roles.
- `frontend/page-transition.css` — the paper "doors" transition between pages.

Breakpoints: 1180 (hide the ghost nav CTA), 1080 (compact nav), 980 (drawer +
stacking), 920 (single-column compositions), 700 (mobile rhythm), 420 (small
phones). Compositions stay two-column down to 920px so 1024px laptops keep
the editorial hero and the catalogue's three-card grid.

## RTL

Layout is written with logical properties throughout (`padding-inline`,
`inset-inline`, `border-inline-start`). Arrows mirror via
`html[dir="rtl"] .arrow { transform: scaleX(-1) }`; the drawer, breadcrumb,
filters, tables and the dashboard sidebar all reuse the same rules, so EN and
AR are one code path rather than two layouts.

## Content and data rules kept from before

- Bilingual EN/AR copy on every page, persisted in `localStorage` (`bbc-lang`).
- No invented prices, schedules, statistics, testimonials or teacher profiles;
  illustrative photography is labelled where it could imply real people.
- Course, level and dashboard data come from the API when one is configured.
  A failed request shows the real error and never becomes a fake success, and
  entered form values are preserved.

## Verification notes

Reviewed at 360, 390, 768, 1024, 1440 and 1920 px in both languages: no
horizontal overflow on any of the 14 pages, the mobile drawer opens, locks
scroll, closes on <kbd>Esc</kbd> and returns focus, the language toggle flips
`lang`/`dir` and copy, booking and contact submit against the live API, and
login rejects a wrong password in place and routes a correct one to the
dashboard.
