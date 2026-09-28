# Assignment notes

## Time spent

- Total: TODO before submission

## Decisions I made

- React + TypeScript and NestJS keep UI, controllers, and persistence separate.
  The current UI is only a responsive connection shell.
- SQLite/Prisma keeps setup local and relational without a database service.
- npm workspaces provide one install and one startup command.
- Prisma 6.19.3 and Vite 6.4.3 support this environment's Node 22.16. Prisma's
  transitive deepmerge-ts is overridden to 8.x to resolve the audit advisory;
  generation, migration, seed, and tests verify the resulting tooling.
- Branch-local measurement times use sortable strings, preserving the absence
  of a timezone. System audit timestamps remain distinct DateTime fields.
- Assignment history models a movable physical logger. Imports snapshot logger,
  fridge, unit, and expected interval; readings retain matching ownership.
  Updating an assignment cannot rewrite those snapshots through cascading FKs.
- Haifa's Fahrenheit configuration is provisional, because the client did not
  explicitly identify its unit.
- Planned analysis uses >5°C and two consecutive valid high readings, avoiding
  classifying a recovered single spike as a sustained problem.
- A provisional gap rule of >30 minutes against a 15-minute expected interval
  avoids treating every small delay as missing data. Analysis is deferred.
- A unique reading identity key supports future exact-duplicate rejection.
  ERR remains raw invalid data with null Celsius, rather than being lost or zeroed.
- Seed readings are illustrative and explicitly normalized by hand. No derived
  incidents or pretend importer results are seeded.

## Questions for Summer before production

1. Is the Haifa legacy logger actually reporting Fahrenheit?
2. What duration above 5°C should count as actionable?
3. What sampling interval should each logger model use?
4. What column names and timestamp formats do real exports use?
5. Should missing data trigger an operational alert?
6. How are logger moves recorded, and how should files spanning a move be split?
7. Do thresholds vary by fridge or product?
8. Does the inspector need downloadable reports?
9. How long should readings be retained?
10. Which timezone applies at each branch? How should daylight-saving repeated
    or missing times and logger clock changes be handled? Until clarified, source
    timestamps remain timezone-free branch-local values.

## What is not done / what I would do with one more hour

Task 2 adds backend CSV import, normalization, validation, and deduplication.
Incident analysis, dashboard, charts, final upload UI, and analyzer business-rule
tests await later tasks. There is no public GitHub remote yet.
Revisit this section honestly near submission, after the requested core tasks.

## AI usage

Codex helped plan and implement the Task 1 scaffold, relational model, seed,
documentation, and verification.

Rejected/corrected AI suggestion:
- The initial plan proposed UTC normalization and derived Incident seed fixtures.
- The user caught both during plan review: timezone-free client data does not
  establish a timezone, and incidents should come from the real analyzer.
- Evidence: [PLAN.md](PLAN.md), local-time fields in
  [schema.prisma](backend/prisma/schema.prisma), the incident-free
  [seed](backend/prisma/seed.ts), and [foundation tests](backend/test/foundation.test.ts).

## Additional approach notes

Task 1 deliberately avoids importing/analyzing data. Direct database access is
for development; future write services must preserve import/reading snapshots,
validate assignment overlaps, and resolve ambiguous timestamps explicitly.

The Prisma 6 migration engine initially returned an opaque error when the SQLite
file did not yet exist on this Windows host. Setup now opens the database using
Prisma Client before migrating; fresh-database tests confirm this works.
Running setup concurrently with Nest watch triggered a Windows process-restart
race during verification. The documented sequence is setup first, then dev;
following that sequence successfully started both applications.

## Task 2 decisions and actual corrections

- Names and identifiers never determine application behavior. Explicit configuration
  controls units and expected intervals. Ashdod / Display 7 / LOGGER-9876 and other
  invented contexts exercise the same pipeline as the assignment fixtures.
- Header aliases are centralized and deliberately finite. Unknown/ambiguous mapping
  and structural CSV errors reject the complete file; invalid values are retained.
- New loggers require an explicit unit. New assignments and forward moves require
  an explicit local start. This avoids guessing a move date from upload time.
  All-invalid-time imports require an existing assignment ID.
- Existing configuration cannot be changed through an upload. Overlaps, backdated
  interval splitting, and files spanning assignments need explicit resolution.
- Decimal arithmetic is used before converting to the existing Float storage.
  Duplicate identity uses normalized finite numbers without display rounding.
  Raw invalid identities include the explicit context to avoid conflating unknown
  times across fridges. Duplicate summaries retain first-import provenance.
- Limits are 2 MiB, 10,000 data rows, and 16 KiB per parsed record, comfortably above
  the representative weekly sheet. Blank physical lines are not counted as rows.
- Existing Task 1 databases receive fixture-label and canonical-key corrections
  through setup without resetting data or changing measurement ownership.
- Real AI correction: my initial row-number calculation relied on csv-parse's
  line counter/raw fragments. Tests exposed wrong starting lines after blank
  lines and quoted CRLF fields. I replaced it with byte-boundary tracking against
  the original decoded CSV. Evidence: csv-parser.ts and the multiline/blank-line
  regression test in csv-parser.test.ts.
