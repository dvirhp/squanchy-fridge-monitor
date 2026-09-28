# Implementation approval history

This is a historical record of approvals and corrections, not a current feature
list. Task boundaries below describe the scope authorized at each point in time.
See README.md for the application's current behavior and setup.

## Task 1 approval record

The user approved initialization only: npm workspaces, React/Vite shell,
NestJS health endpoint, Prisma/SQLite schema, first migration, seed, documentation,
and local verification. Later product tasks require a new instruction.

The user corrected three points before implementation:

1. Preserve branch-local, timezone-free source times. Do not assume UTC.
2. Assignment changes must never reattribute historical imports/readings.
3. Seed underlying readings; do not seed derived incidents.

Implementation uses local-time strings, independent historical context on imports
and readings, a composite foreign key to keep their contexts consistent, and an
empty Incident table. The foundation tests exercise these decisions.

The original AI plan proposed UTC normalization and seeded incident fixtures.
Those suggestions were rejected by the user and corrected before implementation.
This is the actual correction documented in NOTES.md, not an invented example.

## Task 2 approval

The user approved backend-only CSV parsing, explicit column mapping, normalization,
validation, canonical deduplication, transactional import, assignment resolution,
sample CSVs, tests, and documentation. Application behavior must be generic;
assignment examples are fixtures only. The implementation must demonstrate an
unseen Ashdod / Display 7 / LOGGER-9876 context. No analyzer or frontend feature
work is authorized by Task 2.

## Task 3 approval and simplification

The user approved cumulative historical temperature/data-quality analysis,
synchronous recomputation in the import transaction, and isolated assignment
histories. The incident types remain; startedAt may be null for undated invalid rows.

The user rejected stable IDs/reconciliation and assignment-wide uncertainty from
an undated row. Recompute affected fridge history and delete/reinsert derived
findings atomically; logical results must be stable, not database IDs. Undated
invalid evidence is separate and does not suppress dated analysis. Keep details
small. Preserve one-interval continuity versus two-interval gap reporting and
null duration for ongoing/interrupted incidents. Stop before Task 4.

## Task 4 approval and implementation boundaries

Approved: all-fridge dashboard, URL date/branch/status filters, upload workflow,
fridge history with threshold chart and separate incident/data-quality lists,
three small read endpoints, mobile layout, accessible controls and focused tests.
Reuse the schema and analyzer; historical ownership and local timestamps remain.

User simplifications adopted: API returns simple readings/config snapshots rather
than chart ticks/segments; frontend derives continuity. New entities and deliberate
logger moves remain inside upload, with no administration screens. No full reading
table or broad UI/snapshot suite. Recharts is approved; no UI/form/date/server-state
framework. Stop at Task 4 after verification, without final submission work.
