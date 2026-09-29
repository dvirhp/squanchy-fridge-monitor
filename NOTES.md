# Assignment notes

## Time spent

- Planning & architecture: ~30 minutes
- Backend/import/analysis: ~1.5 hours
- Frontend & UI: ~1 hour
- Testing, verification & documentation: ~30–60 minutes
- Total: approximately 3–4 hours

I did not use a continuous timer, so this breakdown is an estimate rather than an
exact tracked total.

## Decisions I made

I made these implementation choices based on the assignment, using AI to explore
and implement alternatives while I reviewed and refined the final approach. They
are not additional answers from Summer.

- React/TypeScript and NestJS separate UI, HTTP and domain logic; SQLite/Prisma
  and npm workspaces keep local startup free of database services or accounts.
  Mobile-first layout follows Summer's phone use; plain CSS and one chart library
  keep the UI small.
- Permanent import/reading snapshots and explicit logger-move start times prevent
  later placements from reassigning historical evidence. Source timestamps stay
  branch-local because the files supply no timezone.
- New loggers require an explicit unit; Haifa's seeded Fahrenheit setting is a
  provisional interpretation of the sample, not an inference from temperature
  values.
- Two consecutive high observations define sustained >5°C warming; isolated
  recovered highs are spikes. Continuity stops after a missed expected observation;
  gaps require >2 intervals. These conservative provisional rules separate
  evidence from guesses.
- Invalid rows retain raw values and source lines so failures are reviewable.
  Canonical identities deduplicate across uploads without relying on filenames.
  Finite column aliases and atomic structural rejection avoid guessing ambiguous
  files.
- Analysis runs synchronously in the import transaction and replaces
  affected-fridge findings. This keeps import and analysis consistent without
  queues or stable-ID reconciliation; the tradeoff is full-history recomputation
  and changing derived IDs.
- All-history is the dashboard default because uploads describe past observations.
  Unknown-date evidence remains visible but cannot establish a problem in a
  selected period. Simple read endpoints and frontend chart segmentation avoid a
  reporting engine.

## Questions for Summer before production

1. Is the Haifa legacy logger actually Fahrenheit, and how are units confirmed
   for other loggers?
2. What duration above 5°C is actionable? Can thresholds vary by fridge or product?
3. What interval should each logger use, and can that setting change during a file?
4. Can we inspect real exports from every logger model: headers, delimiters, dates
   and error codes?
5. Which timezone applies to each branch? How should repeated/missing DST times and
   logger clock changes be handled?
6. How are logger moves recorded? Who can confirm start times or resolve files
   spanning locations?
7. Should missing data itself trigger an operational alert, and to whom?
8. Does the inspector need an exportable report, and in what format?
9. How long should readings be retained?
10. Should gradual warming below 5°C trigger an early warning? If so, what
    rate-of-change and time window should define it?

I would confirm these open questions with Summer before production.

## What is not done / what I would do with one more hour

There is no authentication, notification delivery, live hardware integration,
report export, historical editing, cloud deployment, or branch/logger
administration. The MVP also does not attempt predictive or pre-threshold
warming-trend detection.

Files spanning placements need splitting; entirely undated data cannot establish
a brand-new placement. Large selected histories are not paginated or downsampled.

I used Codex to run browser checks with desktop Chromium and mobile viewport
emulation; I have not tested physical iOS devices or completed a full
screen-reader audit.

The current implementation prioritizes correctness, explicit domain rules and
focused test coverage over additional refactoring. The main maintainability
improvements I would make next are:

- Split the import orchestration into smaller responsibilities for logger/location
  resolution and deduplication while keeping the transaction boundary explicit.
- Replace flexible `Incident.details` JSON access with stronger discriminated
  TypeScript types as the incident model stabilizes.
- Reduce duplicated continuity/date logic between backend analysis and frontend
  chart rendering, either through shared domain utilities or a clearer API
  representation.
- Split the upload workflow into smaller UI components.
- Strengthen branch-name normalization for whitespace variations such as
  `Tel Aviv` versus `Tel  Aviv`.

With one more hour, I would prioritize the low-risk maintainability improvements
above together with a real-phone/keyboard/screen-reader review of upload errors
and chart readouts. With access to real logger exports, I would also test one
genuine export from each available logger model.

I intentionally left larger refactors and additional product features out of the
final pass because the current behavior is covered by focused tests and the
assignment's expected data volume is small. These are proposed next steps, not
completed work.

I preserved the complete development history in the
[public repository](https://github.com/dvirhp/squanchy-fridge-monitor).
The application runs locally and needs no account; it has not been deployed.

## AI usage

I used Codex for planning, implementation of the backend and UI, regression tests,
command/browser verification, formatting, and documentation. I reviewed and
approved the scope, corrected assumptions, requested narrower designs, and
reviewed actual UI screenshots.

I kept the work in staged task commits. The consolidated
[SPEC](SPEC.md), [approval history](PLAN.md), and
[verification log](VERIFICATION.md) remain available for review. Earlier working
versions of the specification are preserved in the Git history.

### Real implementation mistake — CSV source-row tracking

The initial AI-generated calculation relied on parser line counters/raw fragments
and assigned incorrect starting lines after blank lines and inside quoted CRLF
records.

The test `preserves physical source lines including blank and multiline records`
exposed the error. The correction tracks byte boundaries in the original decoded
CSV instead of reconstructing source text.

Evidence: [parser](backend/src/imports/csv-parser.ts),
[regression test](backend/test/csv-parser.test.ts), and commit `0b91d0e`.

That commit contains the fix and regression; the failed intermediate
implementation was not separately committed. The original verification notes
record the failure.

### Real rejected proposal — incident reconciliation

During plan review, I rejected stable derived IDs/reconciliation and
assignment-wide uncertainty from an undated row as unnecessary complexity.

The implementation I approved atomically deletes/reinserts affected findings and
excludes only undated observations from sequencing.

Evidence:
[Task 3 approval](PLAN.md#task-3-approval-and-simplification),
[analysis service](backend/src/analysis/analysis.service.ts),
[repeat/undated tests](backend/test/analysis.test.ts), and commit `c9fc6b8`.

I also chose to preserve branch-local source times rather than invent UTC
timestamps, and to derive incidents through the analyzer rather than seed them
directly. I kept these approved local-time, snapshot and seed decisions documented
in `PLAN.md`.