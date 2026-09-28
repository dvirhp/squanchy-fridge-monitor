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

## Task 2 verification

Verified on the same Windows / Node 22.16.0 / npm 10.9.2 environment on 2026-09-28.

- `npm test`: **26/26 pass**, including the 5 original foundation checks.
  Added parser/header/quoting/UTF-8 and line-number checks, generic Celsius and
  Fahrenheit normalization, real calendar validation, invalid-field preservation,
  canonical identities, same-file and cross-import duplicates, transactional
  rollback, assignment movement/history, all-invalid timestamp context, DTO
  validation, seed upgrade, and the unseen Ashdod scenario.
- A 3,000-row import persisted all rows in one transaction (about 0.6 seconds
  for that test on this host). This is a local observation, not a performance SLA.
- `npm run typecheck`: pass for both workspaces, seed, config, and tests.
- `npm run build`: frontend and backend pass.
- Fresh root `npm run setup` with a new isolated SQLite file: pass, including
  client generation, file creation, initial migration and seed.
- Root setup on the existing Task 1 database: pass, preserving data while
  correcting fixture labels and upgrading identity keys.
- `npm audit`: zero reported vulnerabilities.
- `git diff --check`: pass.
- Source scan found no assignment fixture names/IDs in `backend/src`.

Manual multipart HTTP checks ran against the compiled Nest application on port
3001 and the fresh verification database. Node FormData sent actual file bytes;
database queries checked persistence and Fahrenheit conversion.

| Request | HTTP | Total | Accepted | Invalid | Duplicate |
| --- | --- | --- | --- | --- | --- |
| Celsius fixture, new explicit context | 201 | 4 | 4 | 0 | 0 |
| Fahrenheit reversed-column fixture, new explicit context | 201 | 2 | 2 | 0 | 0 |
| Invalid/duplicate/out-of-order/gap fixture, new explicit context | 201 | 5 | 2 | 2 | 1 |
| Invented Ashdod / Display 7 / LOGGER-9876 | 201 | 2 | 2 | 0 | 0 |
| Repeat mixed-quality fixture | 201 | 5 | 0 | 0 | 5 |
| Missing required column | 400 | — | — | — | — |
| Missing required metadata | 400 | — | — | — | — |
| Unknown metadata field | 400 | — | — | — | — |

Failed HTTP requests left import/reading/branch counts unchanged. The converted
38.3°F reading persisted as 3.5°C, and the Incident table stayed empty.
The temporary server was stopped after verification.

Resolved Task 2 failures: two TypeScript typing mismatches were corrected before
the successful build. Source-line regression tests exposed blank-line and quoted
CRLF counting mistakes; byte offsets against the original decoded text now
preserve correct starting physical line numbers. These regressions pass.

No analyzer, dashboard, chart, or upload UI behavior was added or tested.
