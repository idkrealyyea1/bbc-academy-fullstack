# Graph Report - bbc-academy-fullstack  (2026-11-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 303 nodes · 508 edges · 22 communities (12 shown, 10 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00e80cc5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- MemoryStore
- PgStore
- 001_init.sql
- server.js
- dashboard.js
- app.js
- package.json
- services
- db.js
- api.js
- api.test.js
- pg-smoke.mjs
- scripts
- build.js
- public.current_user_role
- 004_booking_requests.sql

## God Nodes (most connected - your core abstractions)
1. `MemoryStore` - 50 edges
2. `PgStore` - 49 edges
3. `now()` - 14 edges
4. `uid()` - 13 edges
5. `renderAdmin()` - 13 edges
6. `renderStudent()` - 13 edges
7. `renderTeacher()` - 12 edges
8. `boot()` - 11 edges
9. `profiles` - 11 edges
10. `boot()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `profiles_username_unique` --indexes--> `profiles`  [EXTRACTED]
  db/migrations/005_usernames.sql → db/migrations/001_init.sql
- `submissions_assignment_student_unique` --indexes--> `submissions`  [EXTRACTED]
  db/migrations/007_submissions_unique.sql → db/migrations/001_init.sql
- `main()` --calls--> `seedDemo()`  [EXTRACTED]
  backend/src/server.js → backend/src/db.js

## Import Cycles
- None detected.

## Communities (22 total, 10 thin omitted)

### Community 0 - "MemoryStore"
Cohesion: 0.06
Nodes (3): MemoryStore, now(), uid()

### Community 2 - "001_init.sql"
Cohesion: 0.14
Nodes (27): announcements, assignments, attendance, courses, enrolments, grades, idx_assignments_course, idx_attendance_course (+19 more)

### Community 3 - "server.js"
Cohesion: 0.08
Nodes (11): auth(), bad(), bcrypt, cors, express, jwt, origins, PLACEMENT_ANSWERS (+3 more)

### Community 4 - "dashboard.js"
Cohesion: 0.23
Nodes (20): accountCard(), badge(), boot(), confirmDlg(), dashFor(), heading(), labelTableCells(), levelName() (+12 more)

### Community 5 - "app.js"
Cohesion: 0.24
Nodes (21): applyLanguage(), boot(), emptyFilterMessage(), esc(), getLang(), initDemoForms(), initNavigation(), setOpen() (+13 more)

### Community 6 - "package.json"
Cohesion: 0.13
Nodes (18): dependencies, bcryptjs@^2.4.3, cors@^2.8.5, express@^4.19.2, express-rate-limit@^7.2.0, jsonwebtoken@^9.0.2, description, engines (+10 more)

### Community 7 - "services"
Cohesion: 0.14
Nodes (13): key, sync, value, services, buildCommand, env, envVars, healthCheckPath (+5 more)

### Community 8 - "db.js"
Cohesion: 0.18
Nodes (9): pg@^8.12.0, createStore(), crypto, DEMO_COURSES, DEMO_LEVELS, seedDemo(), bcrypt, main() (+1 more)

### Community 9 - "api.js"
Cohesion: 0.31
Nodes (11): base(), clearError(), empty(), errBox(), esc(), lang(), mountEnrol(), req() (+3 more)

### Community 10 - "api.test.js"
Cohesion: 0.20
Nodes (7): app, store, assert, bcrypt, call(), login(), test

### Community 11 - "pg-smoke.mjs"
Cohesion: 0.20
Nodes (5): admin, checks, failed, require, sandbox

### Community 12 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, dev, seed, start, test

## Knowledge Gaps
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `PgStore` connect `PgStore` to `db.js`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Should `MemoryStore` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Why does `MemoryStore` connect `MemoryStore` to `db.js`?**
  _High betweenness centrality (0.150) - this node is a cross-community bridge._
- **Should `PgStore` be split into smaller, more focused modules?**
  _Cohesion score 0.08156028368794327 - nodes in this community are weakly interconnected._
- **Why does `createStore()` connect `db.js` to `MemoryStore`, `PgStore`, `server.js`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Should `001_init.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.135632183908046 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08307692307692308 - nodes in this community are weakly interconnected._