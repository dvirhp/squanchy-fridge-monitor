# Task 1 verification

Verified locally on Windows with Node 22.16.0 and npm 10.9.2 on 2026-09-28.

- `npm install`: completed; root lockfile committed.
- `npm run setup`: completed and repeated without duplicating seed records.
- First migration created and applied; schema validates.
- `npm test`: 5/5 pass. Uses a newly created temporary database, applies the
  committed migration, seeds twice, and removes its own temporary files.
  Covers seed counts/zero incidents, branch normalization, branch-local timestamps,
  ERR preservation, duplicate-key rejection, historical context after assignment
  and logger configuration edits, and import/reading foreign-key consistency.
- `npm run build`: frontend and backend pass.
- `npm run typecheck`: frontend, backend, Prisma seed/config, and tests pass.
- `npm run dev`: Vite and NestJS start from the root command.
- HTTP `GET /health` on port 3000 returns
  `{"status":"ok","database":"connected"}`.
- HTTP `GET /api/health` through Vite returns the same healthy status.
- Frontend `GET /` on port 5173 returns 200 and serves the React entry module.
- `npm audit`: zero reported vulnerabilities after the deepmerge-ts override.

Resolved verification failures:

- The test harness initially resolved Prisma's type entry instead of its CLI;
  it now resolves the package's CLI file explicitly.
- Missing SQLite files caused an opaque Prisma migration error on this host.
  The non-destructive prepare step now creates the file before migration.
- Overlapping setup/client generation and Nest watch caused a Windows restart
  race. Setup and development startup were rerun in the documented sequence.
- One audit request failed due to transient DNS resolution; the later audit passed.

No browser automation was available; startup was verified through compilation,
HTTP responses, and the Vite proxy, not a visual browser test.
No parsing, upload, incident analysis, dashboard, or chart behavior is implemented
or claimed as tested in Task 1.
