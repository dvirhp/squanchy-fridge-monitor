# Squanchy Bakery Fridge Monitor

Summer manages 12 bakery branches and combines weekly logger exports by hand.
This mobile-first app turns **uploaded historical CSV readings** into an all-fridge
overview, temperature history, sustained high-temperature incidents, and data-quality
evidence. It helps answer “when was this fridge above 5°C, and for how long?”
It is not live monitoring and does not infer causes such as an open door.

## Run locally

Prerequisites: Git, **Node.js 22.16+ within Node 22**, and **npm 10+**.
Internet is needed for dependency/Prisma-engine installation; no account, database
server, Docker, or paid service is required to run the app.

Clone the public repository, then run:

```bash
git clone https://github.com/dvirhp/squanchy-fridge-monitor.git squanchy-fridge-monitor
cd squanchy-fridge-monitor
npm ci
npm run setup
npm run dev
```

Open **http://127.0.0.1:5173**. Backend health:
http://127.0.0.1:3000/health (also available through `/api/health` on the frontend).

Setup copies `.env.example` to `backend/.env` if absent, generates Prisma Client,
creates/migrates SQLite, seeds illustrative readings, and runs the real analyzer.
The default database is `backend/prisma/dev.db`; no manual configuration is needed.
Setup preserves existing uploads and can be repeated; derived findings are rebuilt.
Stop servers before rerunning setup or generating Prisma Client, especially on Windows.
Both servers bind to localhost; ports 5173 and 3000 must be free. Stop with Ctrl+C.
If changing backend `PORT`, also change the proxy target in `frontend/vite.config.ts`.

## Try the main flow

1. **Dashboard (`/`)** shows every fridge, with problems first and separate
   temperature/data-quality indicators. The demo has 4 branches, 5 fridges and
   15 readings; it is not a full inventory of Summer's 12 branches.
2. **Upload (`/upload`)**: choose `sample-data/invented-ashdod.csv`, then enter
   new logger `LOGGER-9876`, Celsius, 10-minute interval, new branch `Ashdod`,
   new fridge `Display 7`, and local start `2031-02-03 00:00`.
   Expect 2 accepted readings. Repeat with the existing logger/location to see
   2 duplicates skipped. Use **Back to overview** to see the new fridge.
3. **Fridge history (`/fridges/:id`)**: open its card for the chart and findings.
   Open seeded **Rishon LeZion / Cream cakes** to see sustained warming; open
   **Jerusalem / Dairy** for invalid-reading and gap evidence. Choose a historical
   date range to inspect earlier records.

Uploads collect context missing from files: logger, branch, fridge, and source
unit/start time when required. Existing or new entities use the same workflow.
A deliberate logger move requires its actual local start time. Import results show
accepted/invalid/duplicate rows and analysis totals across the affected fridges'
accumulated history, not only newly created incidents.

More fixtures and exact expected results are in [sample-data/README.md](sample-data/README.md).
They are representative examples, not actual client-uploaded files. Setup seeds
readings, never derived incidents.

## Data assumptions and rules

- **Local timestamps:** supported formats are `YYYY-MM-DD HH:mm`,
  `YYYY-MM-DDTHH:mm`, and `DD/MM/YYYY HH:mm`, each with optional seconds.
  Normalized measurement times are timezone-free `YYYY-MM-DDTHH:mm:ss`.
  No UTC/DST conversion or timezone guessing occurs. Audit/upload times are separate.
- **Units:** each new logger requires explicit Celsius or Fahrenheit configuration;
  temperatures never determine the unit. Fahrenheit uses `C = (F - 32) × 5 / 9`.
  The seeded Haifa logger is provisionally Fahrenheit, to confirm with Summer.
  Charts and analysis use Celsius; raw source values remain stored.
- **CSV validation:** comma-delimited UTF-8, optional BOM, quoted fields, either
  column order and out-of-order readings are supported. Case-insensitive aliases
  are `Time/Timestamp/DateTime` and `Temperature/Temp`. Limits: 2 MiB, 10,000 data
  rows, 16 KiB per parsed record. Malformed/ambiguous files fail atomically.
  Individual invalid rows, including ERR and invalid dates, are retained and reported.
- **Duplicates:** valid identity is logger + normalized timestamp + Celsius value,
  within and across uploads; filenames do not matter. Invalid identity also includes
  fridge, unit and exact raw fields. Repeat imports retain original reading provenance.
  Different values at one timestamp remain evidence of a conflict, not duplicates.
- **Logger moves:** import/reading snapshots preserve historical fridge ownership
  and unit/interval context. Periods are start-inclusive/end-exclusive. Moves append
  a period and close the previous one; old readings stay with their original fridge.
  Split files spanning periods. Contradictory/backdated moves are rejected; an
  entirely undated file requires an explicitly selected existing period.
- **Temperature incidents:** strictly above 5°C for at least two distinct consecutive
  valid high observations. A single high followed by continuous recovery is a
  temporary spike, not a sustained incident; an isolated final high is unconfirmed.
  Recovery is the next continuous reading at or below 5°C. Duration is recovery
  minus first high: a sampling-based estimate, not an exact threshold-crossing time.
  Ongoing/interrupted incidents have unknown end/duration, never time extended to now.
- **Continuity and gaps:** expected sampling defaults to 15 minutes and uses historical
  import snapshots. More than one interval breaks temperature continuity; strictly
  more than two intervals reports a data gap. Interval changes break continuity;
  gap detection uses the smaller neighboring interval. Dated ERR counts as an
  observation for gap bounds but breaks temperature continuity. Invalid/conflicting
  points—including valid + ERR at the same timestamp—cannot extend a run or chart line.
  Lines also stop at assignment boundaries. No gaps are invented outside observed bounds.
- **Historical filtering:** default is all accumulated imports. Date bounds are inclusive
  local days; findings match by overlap and keep full observed bounds/duration.
  Ongoing/interrupted overlap ends at the last observed high. Filters stay in the URL;
  detail navigation preserves dates. Summary counts apply before the status filter.
  Fridge history always shows undated evidence separately; dashboard cards retain its
  count. With either date bound selected,
  it does **not** affect period quality counts/status; without dates it contributes
  to accumulated quality counts. “No detected issue” does not describe current conditions.

## Architecture

React + TypeScript + Vite/React Router, plain CSS and Recharts; NestJS + TypeScript;
Prisma + local SQLite. npm workspaces provide one install and startup command.

```text
React pages → Vite /api proxy → NestJS controllers → services → Prisma → SQLite
Branch → Fridge ← LoggerAssignment → Logger
Import → Reading (permanent historical ownership/configuration)
Fridge → Incident (derived from accumulated readings)
```

`backend/src/imports/` separates parsing, mapping, normalization, validation,
deduplication and assignment resolution. `backend/src/analysis/` contains testable
rules and synchronous recomputation. Each import transaction saves data and replaces
affected-fridge findings together; failure rolls everything back. Late readings can
change findings; derived IDs are not stable. `backend/src/views/` serves read-only
queries. `frontend/src/` contains the three pages and derives chart segments from
simple reading data. No behavior depends on sample names or logger IDs.

Backend routes: `GET /health`, `GET /import-options`,
`GET /dashboard?from=&to=&branchId=&status=`, `GET /fridges/:id?from=&to=`,
and multipart `POST /imports`. The frontend uses the `/api` proxy prefix.

## Checks and useful commands

Run from the repository root after setup:

```bash
npm test
npm run typecheck
npm run build
```

Tests cover parsing, normalization, duplicates, assignments, cumulative analysis,
dashboard semantics, chart continuity, and focused UI interactions. Backend tests
use isolated temporary databases. Both production builds are generated locally;
`build` does not deploy or start a server.

`npm run db:analyze` rebuilds findings; `npm run db:studio` opens the local database
viewer. If running `npm run db:seed` alone, run analysis afterward.

## Scope and development record

No auth, notifications, hardware ingestion, exports, historical editing or cloud
deployment. Selected history is returned without pagination/downsampling; narrow
large histories by date. See [NOTES.md](NOTES.md) for decisions, open questions,
limitations, time reporting and actual AI corrections.

[SPEC.md](SPEC.md) preserves the assignment; [PLAN.md](PLAN.md) preserves approval
history; [VERIFICATION.md](VERIFICATION.md) records checks and known verification
limits. These are retained as evidence of the AI-assisted workflow.
