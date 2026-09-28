# Squanchy Bakery Fridge Monitor

Summer currently combines weekly logger exports by hand. This project will turn
those readings into a mobile-friendly view of fridge temperatures and data quality.

**Current scope: Task 1 foundation only.** The frontend displays connection status,
the backend exposes a database health check, and SQLite contains illustrative seed
readings. Uploads, parsing, analysis, dashboard cards, and charts are not implemented.

## Local quick start

Prerequisites: Node.js 22.16 or newer within Node 22, and npm 10 or newer.
No account, database server, paid service, or deployment is needed.
Internet access is needed to install dependencies and download Prisma engines.

```bash
npm install
npm run setup
npm run dev
```

Setup copies `.env.example` to `backend/.env` only if missing, generates Prisma
Client, opens/creates the SQLite file, applies committed migrations, and seeds the database. It is safe to repeat:
existing configuration and data are preserved. The default database is
`backend/prisma/dev.db`; keep that local file out of Git.

- Frontend: http://localhost:5173
- Backend: http://localhost:3000/health
- Frontend proxy: http://localhost:5173/api/health

The shell should report “Backend and database connected.” Stop both development
servers with Ctrl+C. Both bind to the local machine. Ports 5173 and 3000 must be
available; changing the backend port also requires updating the Vite proxy.
Stop development servers before rerunning setup or generating Prisma Client.

## Root commands

| Command | Purpose |
| --- | --- |
| `npm run setup` | Prepare config, client, database, and seed |
| `npm run dev` | Run both applications with reload |
| `npm run dev:frontend` | Run only Vite |
| `npm run dev:backend` | Run only NestJS |
| `npm run build` | Build both applications |
| `npm run typecheck` | Check application, seed, config, and test TypeScript |
| `npm test` | Run database foundation tests against an isolated temporary database |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:prepare` | Open/create the configured SQLite file without resetting it |
| `npm run db:migrate` | Create/apply a development migration; prompts for a name |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Rerun the additive, idempotent seed |
| `npm run db:studio` | Inspect the local database |

Run setup before builds/tests. The tests create, migrate, seed, and remove their
own temporary database; they do not reset the developer database.

## Stack and architecture

React, TypeScript, Vite, and React Router in `frontend/`; NestJS and TypeScript
in `backend/`; Prisma and SQLite for local relational storage. npm workspaces
share a root lockfile. Prisma 6 and Vite 6 are deliberately pinned to compatible
release lines for the available Node 22.16 environment.

```text
React shell -> Vite /api proxy -> NestJS health controller -> Prisma -> SQLite

Branch -> Fridge
Logger -> LoggerAssignment <- Fridge
LoggerAssignment -> Import (permanent logger/fridge/config snapshots)
Import -> Reading (matching historical logger/fridge)
Fridge / optional Logger -> Incident (empty until the analyzer is built)
```

Controllers remain separate from persistence. Domain modules will be added when
their behavior is implemented. No parser or analyzer is hidden in the seed.

## Data semantics

- Measurement, assignment, and event times are **branch-local strings** in
  `YYYY-MM-DDTHH:mm:ss` format. They have no offset or `Z` suffix and are never
  converted to UTC. The seed explicitly supplies normalized strings and preserves
  original timestamp text. Supporting source-format parsing is a later task.
- `createdAt`, `updatedAt`, and `importedAt` are system audit instants; these
  are separate from the client's timezone-free measurement times.
- Import logger/fridge/unit/interval snapshots are authoritative historical
  context. Assignment links record provenance; never derive historical ownership
  from an assignment's current fields. Logger moves must create a new assignment
  and close the old one, without rewriting import or reading snapshots.
- A composite foreign key enforces matching logger/fridge context between a
  reading and its import. Foreign keys restrict deletion/key changes of referenced
  entities. There are no editing endpoints in Task 1.
- Branch matching uses trimmed, lowercase names in the seed. Fridge names are
  unique within each branch. Assignment periods are half-open `[from, to)`;
  overlap validation belongs to the future assignment workflow.
- Invalid readings preserve raw values and nullable normalized fields. ERR is
  stored as invalid, with a null Celsius value.
- A unique deduplication key prevents repeated identity keys. The future importer
  will build canonical keys from logger/time/value; different readings at the
  same timestamp must remain distinguishable. Task 1 verifies the DB constraint.
- Seed import counts partition rows into accepted-valid, invalid, and duplicate.
  Invalid rows are retained; “accepted” here means valid for temperature analysis.

## Planned business rules (not implemented yet)

Temperature above 5°C is high. Two or more consecutive valid high readings will
constitute a sustained incident; an isolated high reading followed by recovery
will be a spike. Gaps and invalid readings must not imply continuous observed
warming or precise unobserved durations.

Expected sampling is provisionally 15 minutes. The proposed gap threshold is
strictly greater than 30 minutes, to be centralized when analysis is implemented.
Gaps describe missing observations without guessing their cause.

Haifa's legacy logger is provisionally configured as Fahrenheit; this is an
assumption to confirm with Summer. Future normalization uses `C = (F - 32) * 5 / 9`.
The seed has explicitly supplied Celsius fixture values, not a conversion service.

## Demo data and project notes

See [sample-data/README.md](sample-data/README.md) for fixture provenance.
The seed contains 4 branches, 5 fridges, 4 loggers, 5 assignments, 5 illustrative
imports, 15 readings, and **zero incidents**. It demonstrates healthy readings,
a spike, warming, Fahrenheit metadata, ERR, a gap, logger movement, and branch
capitalization. Exact duplicate rejection is covered by the foundation test.
CSV samples and upload instructions will be added with the import task.

[SPEC.md](SPEC.md) is the supplied assignment specification.
[PLAN.md](PLAN.md) records the approved Task 1 scope and corrections.
[NOTES.md](NOTES.md) records decisions, questions, and actual AI usage.
