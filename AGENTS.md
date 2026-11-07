# Agent notes

## Project

BBC English Academy — static frontend (`frontend/`, vanilla HTML/CSS/JS for
Cloudflare Pages) + Express API (`backend/`, `src/server.js`, `src/db.js`) +
Supabase PostgreSQL (`db/migrations/`). Live: Pages
`https://bbc-academy.pages.dev/`, API
`https://bbc-academy-fullstack.onrender.com`, migrations 001–005 applied,
`SEED_DEMO=false` in production.

Data layer rule: `DATABASE_URL` set → `PgStore` (production); unset →
`MemoryStore` (local/tests only, loses data). Both implement the same methods,
so any new store method must be added to **both** classes.

Connected mode rule: with no API base (`frontend/config.js` empty) the site is a
demo with mock handlers; with an API base the real API must be used and a failed
call must never silently fall back to fake success.

Demo accounts (memory store / `SEED_DEMO`): `student@demo.local`,
`teacher@demo.local`, `admin@demo.local`, password `Demo1234!`. Never real
credentials.

Commands: `cd backend && npm install && npm test` (node:test, no DB needed);
`npm start` for the API on :4000; `cd frontend && API_BASE_URL=http://localhost:4000 node build.js`
then serve the folder on :8000.

## Superpowers — development methodology skills

[obra/superpowers](https://github.com/obra/superpowers) is installed locally at
`.opencode/skills/` (15 skills: brainstorming, writing-plans, executing-plans,
subagent-driven-development, test-driven-development, systematic-debugging,
requesting/receiving-code-review, using-git-worktrees,
finishing-a-development-branch, verification-before-completion,
dispatching-parallel-agents, writing-skills, diagnosing-superpowers,
using-superpowers). The directory is gitignored — it is local tooling, not
product code. If it is missing:

```bash
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/sp && cp -r /tmp/sp/skills/* .opencode/skills/
```

Freebuff has no session-start hook, so this section is the bootstrap:

1. Before answering or acting on a task, check the skill list above. If one
   plausibly applies, read `.opencode/skills/<name>/SKILL.md` first and follow
   it exactly, announcing "Using <skill> to <purpose>". Process skills first:
   "let's build X" → `brainstorming`; "fix this bug" →
   `systematic-debugging`; "is this done?" → `verification-before-completion`.
2. Map the skills' harness-agnostic actions to Freebuff tools: todo list →
   `write_todos`; subagent / Task → `spawn_agents`; read → `read_files`;
   create/edit/delete files → `write_file` / `str_replace` (`rm` via shell);
   shell → `run_terminal_command`; grep/glob → `code_search` / `glob`;
   fetch URL → `read_url`; web search → `web_search`; invoke a skill → read its
   `SKILL.md`.
3. User instructions in this file or in chat override skills.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
