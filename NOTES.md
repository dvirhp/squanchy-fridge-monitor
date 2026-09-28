# Assignment notes

## Time spent

**Actual total: not tracked; a reliable total is not available.** No hours are
inferred from commit timestamps, which exclude earlier planning and cannot distinguish
active work from pauses. The author must supply their actual total before submission
if it can be reconstructed honestly; the numeric time requirement remains outstanding.

## Decisions I made

These are implementation choices and provisional rules, not additional answers
from Summer. Some were specified or refined during the assignment/user review.

- React/TypeScript and NestJS separate UI, HTTP and domain logic; SQLite/Prisma
  and npm workspaces keep local startup free of database services or accounts.
  Mobile-first layout follows Summer's phone use; plain CSS and one chart library
  keep the UI small.
- Permanent import/reading snapshots and explicit logger-move start times prevent
  later placements from reassigning historical evidence. Source timestamps stay
  branch-local because the files supply no timezone.
- New loggers require an explicit unit; Haifa's seeded Fahrenheit setting is a
  provisional interpretation of the sample, not an inference from temperature values.
- Two consecutive high observations define sustained >5°C warming; isolated recovered
  highs are spikes. Continuity stops after a missed expected observation; gaps require
  >2 intervals. These conservative provisional rules separate evidence from guesses.
- Invalid rows retain raw values and source lines so failures are reviewable.
  Canonical identities deduplicate across uploads without relying on filenames.
  Finite column aliases and atomic structural rejection avoid guessing ambiguous files.
- Analysis runs synchronously in the import transaction and replaces affected-fridge
  findings. This keeps import and analysis consistent without queues or stable-ID
  reconciliation; the tradeoff is full-history recomputation and changing derived IDs.
- All-history is the dashboard default because uploads describe past observations.
  Unknown-date evidence remains visible but cannot establish a problem in a selected
  period. Simple read endpoints and frontend chart segmentation avoid a reporting engine.

## Questions for Summer before production

1. Is the Haifa legacy logger actually Fahrenheit, and how are units confirmed for other loggers?
2. What duration above 5°C is actionable? Can thresholds vary by fridge or product?
3. What interval should each logger use, and can that setting change during a file?
4. Can we inspect real exports from every logger model: headers, delimiters, dates and error codes?
5. Which timezone applies to each branch? How should repeated/missing DST times and logger clock changes be handled?
6. How are logger moves recorded? Who can confirm start times or resolve files spanning locations?
7. Should missing data itself trigger an operational alert, and to whom?
8. Does the inspector need an exportable report, and in what format?
9. How long should readings be retained?

These are open questions; the app does not claim that Summer has answered them.

## What is not done / what I would do with one more hour

There is no authentication, notification delivery, live hardware integration,
report export, historical editing, cloud deployment, or branch/logger administration.
Files spanning placements need splitting; entirely undated data cannot establish
a brand-new placement. Large selected histories are not paginated/downsampled.
Browser checks used desktop Chromium and mobile viewport emulation, not physical
iOS devices or a full screen-reader audit.

With one more hour, I would prioritize a real-phone/keyboard/screen-reader review
of upload errors and chart readouts, then test one genuine export from each available
logger model. These are proposed next steps, not completed work.

Public GitHub publication is still pending: no remote is configured at this stage.
Publication/submission is intentionally deferred, so a public clone URL cannot yet
be supplied. The local application needs no account.

## AI usage

Codex was used for planning, implementation of the backend and UI, regression tests,
command/browser verification, formatting, and documentation. The user reviewed and
approved scope, corrected assumptions, requested narrower designs, and reviewed
actual UI screenshots. Work is recorded in the staged task commits; the original
[SPEC](SPEC.md), [approval history](PLAN.md) and [verification log](VERIFICATION.md)
remain in the repository.

**Real implementation mistake — CSV source-row tracking.** The initial AI-generated
calculation relied on parser line counters/raw fragments and assigned incorrect
starting lines after blank lines and inside quoted CRLF records. The test
“preserves physical source lines including blank and multiline records” exposed
the error. The correction tracks byte boundaries in the original decoded CSV
instead of reconstructing source text. Evidence: [parser](backend/src/imports/csv-parser.ts),
[regression test](backend/test/csv-parser.test.ts), and commit `0b91d0e`.
That commit contains the fix and regression; the failed intermediate implementation
was not separately committed. The original verification notes record the failure.

**Real rejected proposal — incident reconciliation.** During plan review, the user
rejected stable derived IDs/reconciliation and assignment-wide uncertainty from an
undated row as unnecessary complexity. The approved implementation atomically
deletes/reinserts affected findings and excludes only undated observations from
sequencing. Evidence: [Task 3 approval](PLAN.md#task-3-approval-and-simplification),
[analysis service](backend/src/analysis/analysis.service.ts),
[repeat/undated tests](backend/test/analysis.test.ts), and commit `c9fc6b8`.

Earlier review also rejected inventing UTC source times and seeding derived incidents;
the approved local-time/snapshot/seed decisions are preserved in PLAN.md.
