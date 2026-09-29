# Squanchy Bakery Fridge Monitor — Product & Technical Spec

## 1. Purpose

This document is the consolidated product and technical specification for the
submitted Squanchy Bakery Fridge Monitor.

It evolved from a more detailed working specification used during development.
The original working versions remain preserved in the Git history.

The implementation was intentionally divided into five reviewed tasks, with the
final submission task split into three focused verification and documentation
phases. Each stage was reviewed before expanding the scope.

`PLAN.md` preserves the staged implementation decisions and corrections, while
`VERIFICATION.md` contains the detailed verification history.

The goal of the MVP is simple: replace Summer Smith's manual weekly Excel review
with a local application that makes fridge temperature problems and unreliable
logger data easier to identify and investigate.

---

## 2. Problem

Summer runs operations for Squanchy Bakery, which has 12 branches.

Each branch has refrigerators with temperature loggers. Once a week, branch
managers download logger files and send them to Summer. The files contain only
time and temperature, so Summer manually adds the logger, branch and fridge
information while combining everything in Excel.

This process takes most of Sunday and still makes it easy to miss problems.

The application should help Summer answer:

- Which fridges need attention?
- When did a fridge go above 5°C?
- How long did the problem last?
- Was a high reading only a temporary spike or sustained warming?
- Are gaps or invalid readings making the history unreliable?

The product is based on historical uploaded logger data. It is not a real-time
monitoring system.

Summer frequently works between branches and mainly checks information on her
phone, so the main workflows should also work well on mobile.

---

## 3. Assignment constraints

The solution must:

- run locally on a reviewer's laptop
- require no external account
- require no paid service
- require no deployment
- be startable from the README
- handle approximately 3,000 rows without unnecessary infrastructure

The supplied examples also show several important data problems:

- different timestamp formats
- different temperature representations
- inconsistent branch capitalization
- duplicate readings
- invalid values such as `ERR`
- missing periods
- out-of-order rows
- isolated temperature spikes
- gradual warming
- a logger being moved between fridges

These cases should be handled explicitly rather than hidden during import.

---

## 4. Solution

The MVP has three main user-facing workflows.

### Dashboard

Show all fridges together and make the ones requiring attention easy to find.

Temperature problems and data-quality problems are shown separately because a
bad temperature and unreliable data mean different things operationally.

The dashboard supports simple date, branch and status filtering.

### Upload

Summer uploads a logger CSV and supplies the context that is not contained in
the file:

- logger
- branch
- fridge

The system parses, normalizes and validates the readings before storing them.

The same workflow can introduce a new logger/location or explicitly record a
logger moving to another fridge.

### Fridge history

A fridge details page shows:

- temperature history
- the 5°C threshold
- sustained temperature incidents
- data gaps
- invalid-reading evidence
- historical date filtering

This is the main view for answering the inspector's operational question:
when did this fridge go above 5°C, and for how long?

The MVP answers this from the available historical observations rather than
claiming more precision than the logger data provides.

---

## 5. Technical stack

### Frontend

- React
- TypeScript
- Vite
- React Router
- Recharts
- plain CSS

### Backend

- Node.js
- TypeScript
- NestJS

### Persistence

- SQLite
- Prisma ORM

SQLite was chosen because the assignment is local-first and relational while
requiring no database server or external service.

NestJS provides clear controller/service boundaries without requiring additional
infrastructure.

The application remains a small monolith. Microservices, queues, Redis, Kafka
and cloud infrastructure would add complexity without solving a requirement of
this take-home.

---

## 6. Domain model

### Branch

Represents one bakery branch.

Branch names are normalized for matching so capitalization differences such as
`Tel Aviv` and `tel aviv` do not create separate branches.

### Fridge

Represents a physical refrigerator belonging to a branch.

A fridge owns historical readings and derived findings.

### Logger

Represents a physical temperature logger.

A logger is deliberately separate from a fridge because the assignment shows
that a logger can move between refrigerators.

Logger configuration also stores information such as its temperature unit rather
than guessing the unit from individual numeric values.

### LoggerAssignment

Represents the period during which a logger belongs to a fridge.

This preserves historical ownership when a logger moves. Moving a logger today
must not reattribute readings that were previously collected from another fridge.

### Import

Represents one uploaded logger file and records its upload context and result.

### Reading

Represents imported evidence.

A reading keeps the normalized values used by the application while preserving
raw information needed to explain invalid input.

Historical logger/fridge context is preserved with the imported reading.

### Incident

Represents a derived finding such as:

- temperature incident
- data gap
- invalid reading

Incidents are derived from readings and can therefore be recomputed when new
historical evidence is imported.

---

## 7. Import and normalization rules

Logger files contain only time and temperature. Logger, branch and fridge context
comes from the upload form.

The import pipeline is:

```text
CSV
 ↓
Parse
 ↓
Normalize
 ↓
Validate
 ↓
Deduplicate
 ↓
Resolve historical context
 ↓
Analyze
 ↓
Persist
```

Parsing and normalization are kept outside the HTTP controller so the behavior
can be tested independently.

### Timestamps

The demonstrated formats include:

```text
2026-09-14 06:00
14/09/2026 06:00
```

Source timestamps are treated as branch-local times.

The assignment provides no timezone information, so the MVP does not invent UTC
conversion that could shift the historical readings.

Slash-formatted dates are interpreted as `DD/MM/YYYY`, matching the supplied
example. The MVP does not attempt to guess between `DD/MM/YYYY` and
`MM/DD/YYYY` for ambiguous values.

### Temperature units

The legacy logger values in the assignment are consistent with Fahrenheit, so
the MVP supports explicit Fahrenheit logger configuration and converts those
values to Celsius.

```text
C = (F - 32) × 5 / 9
```

The system does not infer Fahrenheit merely because a temperature value looks
large.

Whether the legacy logger actually reports Fahrenheit remains an assumption to
confirm with Summer before production use.

### Invalid readings

Values such as:

```text
ERR
```

are preserved as invalid evidence.

They are not converted to zero and are not silently discarded.

### Duplicates

An exact repeated measurement for the same logger, timestamp and normalized
value must not affect analysis.

Duplicate handling works across uploads as well as within a single file, so
renaming and uploading the same export does not create new historical evidence.

### Conflicting readings

Multiple readings for the same logger and timestamp with different normalized
values are treated as conflicting observations rather than ordinary duplicates.

Conflicting observations should not be used as if they were reliable continuous
temperature evidence.

### Ordering

Files do not need to arrive in chronological order. Valid observations are
ordered chronologically for analysis.

---

## 8. Temperature analysis

The threshold supplied by the client is:

```text
temperature > 5°C
```

Exactly 5°C is therefore not considered above the threshold.

A single high reading should not automatically become a serious incident because
Summer explained that opening a fridge door can temporarily increase the reading.

For the MVP:

```text
one isolated reading > 5°C followed by recovery
→ temporary spike

two or more consecutive valid readings > 5°C
→ sustained temperature incident
```

This is an implementation rule rather than a client-provided duration and should
be confirmed before production use.

A recovered incident records:

- first observed high reading
- recovery observation
- sampling-based duration
- peak temperature

The duration represents what can be established from the available observations;
it is not an estimate of the exact physical moment the temperature crossed 5°C.

If an incident is still ongoing or the evidence is interrupted, complete duration
remains unknown. The application does not extend historical evidence to the
current clock time.

### Gradual warming

The supplied example also highlights gradual warming as operationally important.

The MVP detects this once the readings cross the configured 5°C threshold and
form a sustained incident. It does not attempt to predict a future threshold
violation from an upward trend that is still below 5°C.

Pre-threshold trend detection would require an agreed definition of meaningful
rate-of-change, time window and alert sensitivity. Those rules were not provided
in the assignment, so they are left as a production follow-up rather than
invented for the MVP.

---

## 9. Continuity and data quality

Temperature analysis depends on continuous evidence.

Invalid observations, multiple readings for the same logger and timestamp with
different normalized values, assignment changes or missing expected observations
can interrupt a temperature run.

Data-gap reporting is related but separate.

The supplied data suggests a 15-minute sampling interval. The MVP reports a
`DATA_GAP` when the distance between observations is greater than two expected
intervals.

This means continuity analysis may be conservative even where the missing period
is not yet large enough to be reported as a separate `DATA_GAP`.

This distinction prevents the application from pretending a temperature stayed
high through evidence that is not actually present.

A gap describes only what is known:

```text
No readings between 06:15 and 08:30
```

It does not claim a cause such as battery failure.

Undated invalid evidence is retained, but it cannot be assigned to a selected
historical date range. When date filters are active it remains visible separately
without changing that period's status or counts.

---

## 10. Historical behavior

Uploads accumulate into fridge history.

Analysis must therefore operate across import boundaries rather than treating
each weekly file as an independent dataset.

This matters when:

- one week's file starts an incident and another provides the recovery
- late readings fill a previously detected gap
- historical evidence changes the shape of an incident
- a logger later moves to another fridge

For affected fridges, derived findings are recomputed from the available
historical evidence.

Stable database IDs for derived incidents are not required by the MVP. The
important property is deterministic logical results.

This avoids introducing reconciliation infrastructure for records that are not
externally referenced.

---

## 11. API and application boundaries

The API is intentionally small and supports product workflows rather than generic
CRUD administration.

The main backend capabilities are:

- import logger data
- retrieve dashboard history and status
- retrieve fridge history
- retrieve upload context and configuration

Controllers remain thin.

Parsing, normalization, validation and analysis remain separate from presentation
and are independently testable.

The frontend is responsible for presentation concerns such as chart segmentation.
The backend remains responsible for business findings such as incidents and gaps.

---

## 12. UX principles

The dashboard is an operational summary, not a raw-reading viewer.

Problems are prioritized ahead of unaffected fridges.

Temperature issues and data-quality issues remain visually distinct.

The fridge page provides deeper historical evidence only when Summer needs it,
including the information required to answer when a sustained threshold incident
started, when it recovered and its observable duration where determinable.

The upload workflow contains the small amount of entity management required by
the product rather than introducing separate administration screens.

The application handles:

- loading
- empty states
- API failures
- retry
- invalid filters
- upload validation errors

The primary pages are designed to remain usable on phone-sized screens.

---

## 13. Intentional scope limits

The MVP does not include:

- authentication or permissions
- notifications
- real-time logger integration
- predictive or pre-threshold warming-trend detection
- background processing
- cloud deployment
- Redis or messaging infrastructure
- microservices
- administration panels
- downloadable inspector reports
- large-history pagination or downsampling

These may matter in a production system, but they are not necessary to
demonstrate the client's core workflow in this assignment.

---

## 14. Implementation stages

The implementation was intentionally divided into five tasks.

Each task expanded the product only after the previous stage had been reviewed.
Detailed task history and verification are kept in `PLAN.md` and
`VERIFICATION.md` rather than duplicated here.

### Task 1 — Foundation

Established the React/NestJS workspace, Prisma/SQLite model, migrations, seed
data, health check and local setup.

The main early decisions were to preserve branch-local timestamps, separate
loggers from fridges, preserve historical logger assignments and derive findings
from source readings rather than seeding incidents directly.

CSV ingestion, analysis and product UI were intentionally left for later stages.

### Task 2 — Import pipeline

Added CSV parsing, normalization, validation, deduplication, explicit
temperature-unit handling, historical assignment resolution and transactional
persistence.

The import path was designed to work with unseen logger, branch and fridge
values rather than only the supplied examples.

Testing exposed an incorrect source-line tracking assumption around blank and
quoted CSV records. The parser was corrected and the regression was retained.

### Task 3 — Historical analysis

Added accumulated-history analysis for sustained temperature incidents,
temporary spikes, data gaps and invalid-reading evidence.

Analysis respects continuity, historical logger assignments and late historical
imports.

A more complex stable-ID reconciliation mechanism for derived incidents was
considered but rejected. Deterministic recomputation was sufficient for the MVP.

### Task 4 — Product UI

Added the dashboard, CSV upload workflow and fridge history view, including
historical filters, temperature/data-quality findings, charting and responsive
layouts.

The API remains focused on historical product data while chart-specific
presentation logic stays in the frontend.

Separate administration screens and a raw-reading table were deliberately
avoided.

### Task 5 — Submission readiness

No new product scope was introduced.

The final task was divided into three phases:

1. code formatting and automated verification
2. documentation and requirement audit
3. fresh-clone and reviewer-flow verification

Representative acceptance CSVs were added so the main business scenarios can be
reproduced through the actual upload workflow.

Detailed verification results are kept in `VERIFICATION.md`.

---

## 15. Definition of done

The MVP is ready when a reviewer can:

1. clone the public repository
2. install and set it up without an external account or database
3. start the frontend and backend locally
4. see useful seeded fridge history
5. upload a logger CSV with logger, branch and fridge context
6. see normalization, invalid and duplicate handling
7. see gaps and sustained temperature incidents
8. see an isolated spike remain distinct from a sustained incident
9. inspect historical fridge temperature data and incident duration where known
10. use the main workflow on a mobile-sized screen
11. run the focused automated test suite
12. understand the assumptions and tradeoffs from the repository documentation

---

## 16. Open production questions

The following points would need confirmation with Summer before production use:

- Is the legacy logger actually reporting Fahrenheit?
- What sampling intervals are expected for each logger model?
- What duration above 5°C should be considered operationally actionable?
- Should gradual warming below 5°C trigger an early warning, and if so, what
  rate-of-change and time window should define it?
- Can temperature thresholds vary by fridge or product?
- Should missing data trigger an alert?
- How are logger moves recorded in the real operational process?
- What additional CSV formats or header names exist in real exports?
- Does the inspector need an exportable report?
- What historical retention period is required?
- What timezone and daylight-saving rules apply to each branch?

These are intentionally treated as open questions rather than invented client
requirements.

---

## 17. Supporting documentation

`README.md` is the source for current setup instructions and user-facing behavior.

`NOTES.md` records final decisions, assumptions, limitations, open questions and
AI usage.

`PLAN.md` preserves the staged implementation decisions, approvals and
corrections.

`VERIFICATION.md` preserves detailed test, browser and clean-clone verification
history.

This specification focuses on the product model, business rules and technical
reasoning behind the submitted MVP.