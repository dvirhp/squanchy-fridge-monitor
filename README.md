# Squanchy Bakery Fridge Monitor

Summer currently combines weekly logger exports by hand. This project will turn
those readings into a mobile-friendly view of fridge temperatures and data quality.

**Current scope: Task 3 historical analysis.** The backend imports CSV readings
and analyzes accumulated history for temperature and data-quality findings.
The frontend remains a connection shell. Dashboard and charts are future work.

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
Client, opens/creates the SQLite file, applies committed migrations, seeds the database,
and runs historical analysis. It is safe to repeat:
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
| `npm test` | Run parser, normalization, foundation, and import tests with isolated databases |
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:prepare` | Open/create the configured SQLite file without resetting it |
| `npm run db:migrate` | Create/apply a development migration; prompts for a name |
| `npm run db:deploy` | Apply committed migrations |
| `npm run db:seed` | Rerun the additive, idempotent seed |
| `npm run db:analyze` | Recompute findings from all accumulated fridge history |
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
Fridge / optional Logger -> Incident (derived from accumulated history)
```

The thin import controller delegates to an import service. Parsing, column mapping,
normalization, validation, canonical identity, and assignment resolution are separate
modules. No application behavior depends on seed names or sample files.

## Data semantics

- Measurement, assignment, and event times are **branch-local strings** in
  `YYYY-MM-DDTHH:mm:ss` format. They have no offset or `Z` suffix and are never
  converted to UTC. The seed explicitly supplies normalized strings and preserves
  original timestamp text. The importer supports the formats documented below.
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
  the importer rejects overlaps and files spanning assignment intervals.
- Invalid readings preserve raw values and nullable normalized fields. ERR is
  stored as invalid, with a null Celsius value.
- A unique canonical key prevents duplicate readings within and across imports;
  different normalized temperatures at the same timestamp remain distinguishable.
- Seed import counts partition rows into accepted-valid, invalid, and duplicate.
  Invalid rows are retained; “accepted” here means valid for temperature analysis.

## Business rules

Temperature strictly above 5°C is high. Two or more consecutive valid high
observations at distinct timestamps constitute a sustained incident. One high
followed by a continuous recovery is a spike, not a temperature incident.
Gaps and invalid readings never imply uninterrupted observed warming.

Expected sampling defaults to 15 minutes. Analysis uses the historical Import
snapshot interval. Temperature continuity allows at most one interval between
valid observations; gap reporting requires strictly more than twice the interval.
Gaps describe missing observations without guessing their cause.

Haifa's legacy logger is provisionally configured as Fahrenheit; this is an
assumption to confirm with Summer. Normalization uses `C = (F - 32) * 5 / 9`.
The seed has explicitly supplied Celsius fixture values, not a conversion service.

## Demo data and project notes

See [sample-data/README.md](sample-data/README.md) for fixture provenance.
The seed contains 4 branches, 5 fridges, 4 loggers, 5 assignments, 5 illustrative
imports and 15 readings. The seed inserts **zero incidents**; setup runs the real
analyzer, producing one temperature incident, one gap, one invalid-reading finding,
and one temporary spike summary. It demonstrates healthy readings,
a spike, warming, Fahrenheit metadata, ERR, a gap, logger movement, and branch
capitalization. Exact duplicate rejection is covered by the foundation test.
CSV samples and upload instructions are described below.

[SPEC.md](SPEC.md) is the supplied assignment specification.
[PLAN.md](PLAN.md) records the approved Task 1 scope and corrections.
[NOTES.md](NOTES.md) records decisions, questions, and actual AI usage.

## CSV import API

`POST /imports` accepts multipart/form-data:

| Field | Rule |
| --- | --- |
| `file` | Required UTF-8 CSV, up to 2 MiB and 10,000 data rows |
| `loggerExternalId` | Required nonempty identifier; case-sensitive, trimmed |
| `branch`, `fridge` | Required names; trimmed and matched case-insensitively |
| `temperatureUnit` | CELSIUS or FAHRENHEIT; required when creating a logger |
| `expectedIntervalMinutes` | Optional integer 1–1440; defaults to 15 for new loggers |
| `assignmentValidFrom` | Explicit branch-local start for a first assignment or forward move |
| `assignmentId` | Optional existing assignment; required if all source timestamps are invalid |

Unknown metadata fields are rejected. Existing logger configuration is reused;
supplying a conflicting unit or interval returns 409 rather than changing it.
New branches/fridges/loggers are created transactionally, so any failed import
also rolls back their creation. No registry endpoint is needed to use a new context.

Run this from the repository root (use `curl.exe` in Windows PowerShell):

```bash
curl -X POST http://localhost:3000/imports -F "file=@sample-data/invented-ashdod.csv" -F "loggerExternalId=LOGGER-9876" -F "branch=Ashdod" -F "fridge=Display 7" -F "temperatureUnit=CELSIUS" -F "expectedIntervalMinutes=10" -F "assignmentValidFrom=2031-02-03 00:00"
```

A successful request returns HTTP 201:

```json
{
  "importId": "...",
  "assignmentId": "...",
  "totalRows": 2,
  "acceptedRows": 2,
  "invalidRows": 0,
  "duplicateRows": 0,
  "analysis": {
    "fridgeIds": ["..."],
    "temperatureIncidents": 0,
    "dataGaps": 0,
    "invalidReadings": 0,
    "temporarySpikes": 0
  }
}
```

Repeat uploads create a new Import summary with duplicate counts, retaining the
original Reading records and provenance. Counts satisfy
`totalRows = acceptedRows + invalidRows + duplicateRows`.
Invalid counts include only newly retained invalid rows.
Analysis counts cover accumulated history for the affected fridges, not just this
file. `analysis.invalidReadings` counts quality findings, including same-time conflicts.

## Supported CSV contract

- Comma-delimited UTF-8, optional BOM, LF/CRLF/CR line endings, standard CSV quoting
  and escaped quotes. Empty physical lines are skipped. Quoted multiline fields
  are preserved; their source row number is their starting physical line.
- Header matching trims surrounding whitespace and ignores case. Timestamp aliases:
  **Time, Timestamp, DateTime**. Temperature aliases: **Temperature, Temp**.
  Aliases live only in `column-mapping.ts`. Either column order is accepted.
- Exactly one recognized column per semantic field is required. Extra unrelated
  columns are ignored; branch/fridge/logger context always comes from metadata.
  Missing/ambiguous headers, malformed quoting, inconsistent row widths, invalid
  UTF-8, NUL bytes, empty files, and header-only files fail before any persistence.
- Each record is limited to 16 KiB by the CSV parser.
- Times support `YYYY-MM-DD HH:mm`, `DD/MM/YYYY HH:mm`, optional seconds,
  and `YYYY-MM-DDTHH:mm:ss`. Calendar dates and clock ranges are validated.
  Offsets/Z suffixes are unsupported. Valid output is `YYYY-MM-DDTHH:mm:ss`.
- Temperatures accept signed decimal notation with a dot. Units, decimal commas,
  exponent notation, NaN, Infinity, and partial numbers are invalid.
  Leading/trailing value whitespace is ignored for normalization but retained raw.
- ERR/non-numeric temperatures become INVALID with null Celsius. Invalid times
  become INVALID with null recordedAt. An independently valid temperature/time
  is still retained, and validationError explains each failing field.

## Identity and historical assignments

The canonical identity is versioned JSON: valid rows use logger ID, normalized
local timestamp, and normalized Celsius. Invalid rows use logger ID, fridge ID,
unit, and both exact raw fields. File names, import IDs, and source line numbers
do not participate. Decimal arithmetic avoids intermediate binary conversion
artifacts; values are ultimately persisted as JavaScript/SQLite floating-point
numbers. Identity uses those normalized numbers without display rounding or an
epsilon tolerance. Sub-float distinctions cannot be retained by this schema.

Rows are sorted by local timestamp, with unknown times last and source line as
the tie-breaker. Database consumers must still request explicit ordering.
The service checks existing keys, deduplicates the current file, and relies on the
unique constraint as a final guard. A cross-fridge duplicate is a conflict.
Concurrent conflicts fail atomically with a retry message; there is no background
retry queue.

An existing assignment must contain all parseable row timestamps, even if their
temperatures are invalid. Historical uploads use the matching closed interval.
First assignments and forward moves require an explicit start; moves close the
previous open interval and append a new one. No automatic backdated splitting is
performed. Moves contradicting stored readings or unknown-time readings in the
previous assignment fail. Files spanning assignments must be split.
All-invalid-time files need an explicit existing assignment ID. This records
operator-provided context without inventing measurement dates.

Imports snapshot logger/fridge/unit/interval, and readings retain matching ownership.
No import path rewrites historical ownership. Task 1 seed label corrections keep
entity IDs intact; setup upgrades legacy identity keys without changing measurements.
Re-run `npm run setup` before starting the updated backend on a Task 1 database.

The HTTP layer uses Nest's [multipart interceptor](https://docs.nestjs.com/techniques/file-upload);
CSV syntax handling uses [csv-parse](https://csv.js.org/parse/api/sync/).

## Historical analysis and uncertainty

The rules are centralized in `backend/src/analysis/analysis.rules.ts`.
A recovered incident starts at the first high, ends at the next continuous <=5°C
reading, and records the peak. Duration is recovery minus first high in branch-local
minutes: 06:15 high, 06:30 high, 06:45 recovery gives 30 minutes. This is a
sampling-based historical estimate, not proof of the exact physical threshold
crossing time. Local calendar arithmetic applies no timezone or DST conversion.

Temperature details carry one of three states:

- RECOVERED: observed continuous recovery, with end and duration.
- ONGOING: no recovery observed before the dataset ends; end and duration are null.
  This describes historical observations, not live fridge health.
- INTERRUPTED: missing/invalid/conflicting observations, interval changes, or an
  assignment end broke continuity. End and duration remain null; lastObservedHighAt
  and interruptionReason describe the observed limit.

No duration extends to upload time or current time. A lone final high is unconfirmed:
neither a sustained incident nor a recovered spike. The system never claims a
cause such as a door opening.

With a 15-minute interval, 06:00 to 06:30 breaks temperature continuity but does
not create a DATA_GAP; 06:00 to 06:31 does both. If neighboring snapshot intervals
differ, continuity breaks and gap reporting uses the smaller interval.
Timestamped ERR readings count as logger observations for gap bounds, while
separately breaking temperature continuity. Different values at one timestamp
form one conflicting point and an INVALID_READING finding, never consecutive highs.
Undated invalid readings have null startedAt, are excluded from chronological
sequencing, and do not suppress supported dated incidents. They remain evidence
that the dataset may be incomplete.

No gaps are inferred before the first observation, after the last, or across
assignments. Gap duration measures the interval between bounding observations,
not temperature conditions during that interval.

## Reanalysis and persistence

ImportsService delegates to AnalysisService after writing readings and before
committing the same transaction. Analysis failure rolls back the import and
replacement of findings. The service loads full accumulated histories for affected
fridges, partitions by historical fridge/logger/assignment, computes findings,
deletes previous Incident rows for those fridges, then inserts the new set.
A logger move also recomputes the previous fridge when its assignment closes.
Historical ownership comes from reading/import snapshots.

Import boundaries do not split continuous sequences. Late historical readings
can remove gaps, join high sequences, or reveal recovery; later readings can close
an ongoing incident. Repeat analysis and duplicate-only uploads preserve logical
finding content/counts. Derived database IDs and audit timestamps may change.
Unrelated fridges remain untouched.

Incident.startedAt is nullable for undated evidence. The existing TEMPERATURE,
DATA_GAP, and INVALID_READING types remain; small details objects store assignment
context, state/bounds, or validation/source references. Spikes are returned by
the pure analyzer and counted in summaries rather than persisted as incidents.
Conflicting observations do not alter source Reading values or statuses.

`npm run db:analyze` rebuilds all findings; setup invokes it after seeding.
If you run `npm run db:seed` alone, run analysis afterward. This straightforward
full-scope approach targets the small local dataset, without background processing.

## Future Task 4 direction

The dashboard will use accumulated history, with simple date-range, branch, and
status filters and visual priority for problems. Fridge Details will support
date-range historical investigation. Queries should select findings overlapping
the requested range, including events starting earlier; interrupted events use
their observed bounds and undated evidence stays explicitly undated.
These UI features are not implemented in Task 3.
