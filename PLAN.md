# Task 1 approval record

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
