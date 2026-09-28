# Squanchy Bakery Fridge Monitor --- Implementation Spec

## 0. Agent mission

Build a complete take-home assignment for Triolla based on the client
brief. Treat this document as the working implementation specification.

The goal is not to maximize feature count. Build a small, coherent,
well-structured product that translates a non-technical client's problem
into useful software and is easy for reviewers to run locally and
discuss in a follow-up interview.

Work incrementally. Keep the repository history and working artifacts
natural; do not "clean up" the development process at the end.

------------------------------------------------------------------------

## 1. Product context

Summer Smith runs operations for Squanchy Bakery, a chain of 12
branches. Each branch has several refrigerators with small temperature
loggers.

Today, once a week, each branch manager downloads a logger file and
emails it to Summer. Summer manually combines the data into Excel and
looks for temperature problems. This takes most of Sunday and problems
can still be missed.

Her main operational questions are:

1.  How is every fridge doing?
2.  Where is something wrong?
3.  When did a fridge go above 5°C?
4.  How long did it remain above 5°C?
5.  Is a high reading only a temporary door-opening spike, or does it
    indicate a sustained warming problem?
6.  Are there gaps or invalid readings that make the data unreliable?

The application should turn raw logger files into a clear operational
view.

Summer is frequently between branches and mostly checks information on
her phone, so the UI must be responsive and mobile-friendly.

------------------------------------------------------------------------

## 2. Source constraints from the assignment

The logger files themselves contain only:

-   time
-   temperature

Today Summer manually adds:

-   logger number
-   branch
-   fridge

The supplied sample data contains examples of:

-   different timestamp formats
-   different temperature representations
-   inconsistent branch capitalization
-   duplicate readings
-   an `ERR` temperature value
-   missing time ranges
-   out-of-order rows
-   a one-reading temperature spike
-   gradual sustained warming
-   a logger that was moved from one fridge to another

The real weekly sheet is around 3,000 rows.

The application must:

-   run locally on a laptop
-   require no external account
-   require no paid service
-   not require deployment
-   be startable by following the repository README

The submission must contain:

-   a public GitHub repository
-   `README.md`
-   `NOTES.md`

------------------------------------------------------------------------

## 3. Chosen technical stack

Use a simple monorepo/repository structure.

### Frontend

-   React
-   TypeScript
-   Vite
-   React Router
-   a lightweight chart library if needed
-   plain CSS/CSS modules or another lightweight styling approach; avoid
    unnecessary UI-framework complexity

### Backend

Use:

-   Node.js
-   TypeScript
-   NestJS

NestJS is preferred here because it gives clear
module/service/controller boundaries and makes the parsing and analysis
domain logic easy to organize and test.

Do not introduce microservices.

### Database

Use:

-   SQLite
-   Prisma ORM

Reasons:

-   fully local
-   relational
-   zero external infrastructure
-   easy setup for reviewers
-   appropriate relationships for branches, fridges, loggers, imports,
    readings and incidents

The database file must not require a separately installed database
server.

### Testing

Add focused tests for business-critical logic, especially:

-   parsing/normalization
-   Fahrenheit conversion
-   duplicate handling
-   invalid readings
-   gap detection
-   spike vs sustained incident detection

Do not chase meaningless coverage percentages.

------------------------------------------------------------------------

## 4. Repository structure

Preferred structure:

``` text
squanchy-fridge-monitor/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── types/
│   │   └── utils/
│   └── ...
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── src/
│   │   ├── branches/
│   │   ├── fridges/
│   │   ├── loggers/
│   │   ├── imports/
│   │   ├── readings/
│   │   ├── incidents/
│   │   └── common/
│   └── ...
├── sample-data/
├── README.md
├── NOTES.md
└── SPEC.md
```

Exact folder names may change if there is a good reason, but keep domain
boundaries clear.

------------------------------------------------------------------------

## 5. Core domain model

Design the schema relationally.

### Branch

Represents a bakery branch.

Suggested fields:

-   `id`
-   `name`
-   timestamps

Branch names should be normalized for matching so `Tel Aviv` and
`tel aviv` do not accidentally become different branches.

### Fridge

Represents a physical refrigerator.

Suggested fields:

-   `id`
-   `name`
-   `branchId`
-   timestamps

Relationship:

-   Branch 1 → many Fridges

### Logger

Represents a physical temperature logger.

Suggested fields:

-   `id`
-   `externalId`, e.g. `TL-0417`
-   unit/configuration if known
-   timestamps

Important: a logger is NOT permanently equivalent to a fridge.

The brief explicitly demonstrates that a logger may be moved from one
fridge to another.

### LoggerAssignment

Track which fridge a logger belongs/belonged to over time.

Suggested fields:

-   `id`
-   `loggerId`
-   `fridgeId`
-   `validFrom`
-   `validTo` nullable

Relationships:

-   Logger 1 → many assignments
-   Fridge 1 → many logger assignments

This allows `TL-0417` to belong to `Walk-in` during one period and later
`Display 2`.

### Import

Represents one uploaded logger file.

Suggested fields:

-   `id`
-   original filename
-   loggerId
-   fridgeId / assignment context
-   importedAt
-   row counts
-   accepted/rejected/duplicate counts where useful

### Reading

Represents a normalized logger reading.

Suggested fields:

-   `id`
-   `loggerId`
-   `fridgeId`
-   `importId`
-   `recordedAt`
-   `temperatureCelsius` nullable
-   `rawTemperature`
-   `status` / validity information
-   timestamps

Preserve enough raw information to explain what was received rather than
silently losing bad data.

Add an appropriate uniqueness strategy to prevent exact duplicate
readings from affecting analysis.

### Incident

Represents a derived operational/data-quality event.

Suggested types:

-   `TEMPERATURE`
-   `DATA_GAP`
-   `INVALID_READING`

Suggested fields:

-   `id`
-   `fridgeId`
-   `loggerId` where relevant
-   `type`
-   `startedAt`
-   `endedAt` nullable
-   `durationMinutes` nullable
-   `peakTemperatureCelsius` nullable
-   metadata/details if useful

Do not over-generalize the model if separate domain types are cleaner.

------------------------------------------------------------------------

## 6. Upload workflow

Primary workflow:

``` text
Select logger file
      ↓
Select/enter logger
      ↓
Select branch
      ↓
Select fridge
      ↓
Upload
      ↓
Parse
      ↓
Normalize
      ↓
Validate
      ↓
Analyze
      ↓
Persist
      ↓
Show import result/dashboard
```

The actual logger file should contain only time and temperature.

The UI therefore supplies the contextual information that Summer
currently adds manually:

-   logger
-   branch
-   fridge

If the selected logger is being associated with a different fridge than
its current assignment, handle/update the assignment history rather than
rewriting historical readings.

------------------------------------------------------------------------

## 7. File parsing requirements

Create a dedicated parsing/normalization layer. Do not bury parsing
logic inside an HTTP controller.

### Required behavior

The parser should be tolerant of realistic differences in logger
exports.

At minimum:

-   identify time/timestamp column
-   identify temperature column
-   tolerate column order differences
-   normalize timestamps into one internal representation
-   sort readings chronologically before analysis
-   preserve/report invalid rows
-   prevent exact duplicates from changing analysis

Because the assignment does not provide actual logger files, create
representative CSV files under `sample-data/`.

Keep invented formats reasonable and document the assumptions.

### Timestamp normalization

Support the formats demonstrated by the supplied sample, including:

``` text
2026-09-14 06:00
14/09/2026 06:00
```

Store normalized timestamps consistently.

Do not invent timezone complexity unless necessary. Document the chosen
assumption.

### Temperature normalization

The Haifa logger uses a different numeric representation. The working
assumption for this implementation is that it reports Fahrenheit.

Convert Fahrenheit to Celsius using:

``` text
C = (F - 32) × 5 / 9
```

Examples:

``` text
38.3°F ≈ 3.5°C
39.0°F ≈ 3.9°C
```

Important: the original client brief does NOT explicitly say the unit is
Fahrenheit. This is an implementation assumption and must be documented
in `NOTES.md` and listed as something to confirm with Summer before
production.

Prefer logger-level configuration/metadata over guessing the unit
independently for every individual reading.

### Invalid values

Example:

``` text
ERR
```

Do not convert this to `0`. Do not silently discard it.

Record/report it as an invalid reading/data-quality issue.

### Duplicate readings

Treat an exact repeated reading for the same logger/timestamp/value as a
duplicate and ensure it does not affect temperature analysis.

Report duplicate handling in the import summary where practical.

------------------------------------------------------------------------

## 8. Gap detection

Summer explicitly says files sometimes contain gaps of a few hours.

The application should detect suspicious gaps between expected readings.

The sample suggests readings commonly occur every 15 minutes. For this
take-home, choose and document a clear rule.

Recommended MVP rule:

-   infer/use an expected 15-minute interval for the provided sample
    data
-   flag a `DATA_GAP` when the interval is materially larger than
    expected
-   do not claim to know WHY the gap happened

The UI may say:

``` text
Missing data
No readings between 06:15 and 08:30
```

It must NOT say:

``` text
Battery died
```

because the available data does not establish the cause.

Keep the threshold/configuration easy to change.

------------------------------------------------------------------------

## 9. Temperature analysis rules

The health threshold from the client is:

``` text
temperature > 5°C
```

But a single high reading can happen when a door is opened for a
delivery and should not automatically become a serious incident.

### Working MVP rule

Use consecutive readings to distinguish a temporary spike from a
sustained temperature incident.

Recommended:

``` text
one isolated reading > 5°C
followed by recovery
→ temporary spike, not a temperature incident

2 or more consecutive valid readings > 5°C
→ TEMPERATURE incident
```

Keep this rule centralized/configurable rather than scattering `5` and
`2` throughout the code.

### Example: temporary spike

Tel Aviv Walk-in:

``` text
05:45  4.0
06:00  4.1
06:15  9.4
06:30  4.3
```

Interpretation:

-   high reading detected
-   immediately recovers
-   not a sustained temperature incident

It can still be visible in the detailed chart/history as contextual
information if useful.

### Example: sustained warming

Rishon LeZion Cream cakes:

``` text
06:00  4.6
06:15  5.4
06:30  6.3
06:45  7.1
```

Interpretation:

-   sustained readings above threshold
-   temperature continues to rise
-   create a temperature incident

The incident should expose enough information to answer:

-   when it started
-   when it ended, if it ended
-   duration
-   peak temperature

Be careful when data gaps make duration uncertain. Do not manufacture
precision that the readings do not support.

------------------------------------------------------------------------

## 10. Dashboard requirements

The dashboard's primary job is NOT to display thousands of raw readings.

It should answer:

> Where does Summer need to look?

Use a mobile-first card-based design.

Suggested top summary:

``` text
Fridge Monitor

12 branches
X fridges

Problems: N
Data issues: N
Healthy: N
```

Each fridge card should communicate at a glance:

-   branch
-   fridge
-   latest valid temperature
-   status
-   latest relevant issue

Example:

``` text
Rishon LeZion
Cream cakes

Problem
7.1°C

Sustained temperature issue
Above 5°C since 06:15
```

Another:

``` text
Jerusalem
Dairy

Data issue
Missing readings
06:15–08:30
```

Prioritize problematic fridges visually/order-wise over healthy ones.

Possible filters:

-   All
-   Problems
-   Data issues
-   Healthy

Do not overbuild filtering unless time allows.

------------------------------------------------------------------------

## 11. Fridge details page

Clicking/tapping a fridge should open a details page.

Show:

### Header/status

-   branch
-   fridge
-   current/latest status
-   latest valid temperature
-   logger

### Temperature chart

Plot temperature over time.

Include a visible 5°C threshold if the chart library makes this
straightforward.

The chart should make a one-reading spike visually distinguishable from
gradual warming.

### Incident history

For each sustained temperature incident show:

-   start
-   end / ongoing
-   duration where determinable
-   peak temperature

This view is what allows Summer to answer the Ministry of Health
inspector.

### Data-quality information

Show relevant:

-   gaps
-   invalid readings

Do not overwhelm the primary operational view with every raw
implementation detail.

------------------------------------------------------------------------

## 12. Import result

After an upload, show a concise result such as:

``` text
Import complete

Accepted readings: 94
Duplicates ignored: 1
Invalid readings: 1
Data gaps found: 1
Temperature incidents found: 1
```

If the entire file cannot be understood, fail clearly with an actionable
error rather than partially inventing mappings.

------------------------------------------------------------------------

## 13. Seed/sample data

The repository must be demonstrable immediately after local setup.

Create sample data based on the supplied assignment examples and, where
needed, additional clearly invented data.

Ensure the demo contains at least:

1.  healthy fridge
2.  one-reading spike
3.  sustained warming incident
4.  Fahrenheit logger
5.  invalid `ERR` reading
6.  duplicate reading
7.  data gap
8.  logger moved between fridges
9.  inconsistent branch capitalization / normalization case

Do not pretend invented data came from the client.

------------------------------------------------------------------------

## 14. API design

Keep the API small and RESTful.

Possible endpoints:

``` text
POST   /imports
GET    /branches
GET    /fridges
GET    /fridges/:id
GET    /fridges/:id/readings
GET    /fridges/:id/incidents
GET    /dashboard
```

Exact routes may be adjusted if the resulting design is cleaner.

Do not create CRUD endpoints simply because entities exist. Build
endpoints that serve the actual product flows.

Use DTO validation for upload metadata and request inputs.

------------------------------------------------------------------------

## 15. Backend architecture

Keep responsibilities separated.

Example flow:

``` text
ImportsController
      ↓
ImportsService
      ↓
LoggerFileParser
      ↓
ReadingNormalizer
      ↓
ReadingValidator
      ↓
TemperatureAnalyzer / IncidentDetector
      ↓
Repositories / Prisma
```

Principles:

-   controllers remain thin
-   parsing is testable independently
-   normalization is testable independently
-   incident rules are pure/testable where practical
-   persistence concerns do not define domain rules
-   constants/config contain thresholds
-   errors are explicit and understandable

Do not introduce queues, Redis, Kafka, WebSockets, microservices or
cloud infrastructure. They do not solve the stated take-home problem.

------------------------------------------------------------------------

## 16. Frontend architecture

Suggested pages:

``` text
/
Dashboard

/upload
Upload/import

/fridges/:id
Fridge details
```

Suggested reusable components:

-   `StatusBadge`
-   `FridgeCard`
-   `SummaryCards`
-   `UploadForm`
-   `TemperatureChart`
-   `IncidentList`
-   `DataQualityNotice`

Keep server state/API access separated from presentation components.

Handle:

-   loading
-   empty state
-   API error
-   upload success/error

Design mobile-first, then expand cleanly to desktop.

------------------------------------------------------------------------

## 17. Status model

Keep operational status simple.

Suggested fridge-level statuses:

``` text
HEALTHY
TEMPERATURE_PROBLEM
DATA_ISSUE
```

If both a temperature problem and a data issue exist, the API/UI should
be able to expose both underlying issues even if one primary status is
chosen for the card.

Do not conflate:

-   bad temperature
-   missing data
-   invalid logger output

They mean different things operationally.

------------------------------------------------------------------------

## 18. Out of scope

Do NOT build these for the MVP unless all core requirements are already
excellent:

-   authentication
-   roles/permissions
-   SMS alerts
-   email alerts
-   push notifications
-   real-time hardware integration
-   background queues
-   Redis
-   Kafka
-   microservices
-   Kubernetes
-   AWS/cloud deployment
-   paid services
-   elaborate admin panels

These can be mentioned as future production considerations if relevant.

------------------------------------------------------------------------

## 19. README.md requirements

Create the README as part of the implementation, not as an afterthought.

It must let a reviewer go from clone to running in a few minutes.

Include:

### Project overview

Short explanation of the client problem and solution.

### Tech stack

Frontend, backend, database.

### Prerequisites

For example:

-   Node.js supported version
-   npm

Avoid requiring anything else if possible.

### Quick start

Prefer a root-level developer experience such as:

``` bash
npm install
npm run setup
npm run dev
```

or another equally simple approach.

If workspaces/root scripts make this clean, use them.

`setup` should ideally:

-   install/prepare what is needed
-   generate Prisma client
-   create/migrate SQLite database
-   seed demo data

Do not make the reviewer manually execute a long sequence of commands.

### URLs

Document frontend/backend local URLs.

### Running tests

One clear command if possible.

### Architecture

Brief description and simple text diagram.

### Business rules

Document:

-   5°C threshold
-   spike vs sustained incident
-   gap rule
-   Fahrenheit assumption
-   duplicate behavior

### Sample files

Explain where they are and how to test uploads.

------------------------------------------------------------------------

## 20. NOTES.md requirements

This file is explicitly required by Triolla.

Keep it concise, candid and useful.

Use these sections:

### Time spent

Leave a placeholder to fill honestly at submission time.

``` text
- Total: TODO before submission
```

### Decisions I made

Include decisions such as:

-   React + Node/NestJS
-   SQLite/Prisma for zero-service local execution
-   mobile-first dashboard
-   logger-to-fridge assignment history
-   Fahrenheit assumption for the legacy Haifa logger
-   isolated spike vs sustained incident rule
-   gap detection rule
-   duplicate handling
-   preserving/reporting invalid readings

Explain WHY, not only what.

### Questions for Summer before production

Include questions such as:

1.  Is the Haifa legacy logger actually reporting Fahrenheit?
2.  What exact duration above 5°C should count as an actionable
    incident?
3.  What is the expected sampling interval for each logger model?
4.  Can different logger models export different column names/formats?
5.  Should missing data itself trigger an operational alert?
6.  When a logger moves to another fridge, how is that move recorded
    operationally?
7.  Are thresholds always 5°C, or can they vary by fridge/product type?
8.  Does the inspector need downloadable/exportable reports?
9.  How much historical data should be retained?

Do not answer these as if the client provided answers.

### What is not done / what I would do with one more hour

Fill this honestly near submission.

Potential examples only if they remain undone:

-   stronger import mapping UI
-   exportable inspector report
-   more edge-case tests
-   accessibility polish
-   richer filtering

### AI usage

The assignment specifically asks for:

-   how AI tools were used
-   one thing AI got wrong or proposed that was rejected
-   how it was caught
-   where the evidence can be seen in the repository

Do NOT fabricate this now.

Create a placeholder and update it during development with a REAL
example.

Example structure:

``` text
### AI usage

I used [tool] for ...

Rejected/corrected AI suggestion:
- TODO: record a real example during implementation.
- How I caught it:
- Evidence:
```

### Additional approach notes

Optionally mention tradeoffs and intentionally omitted complexity.

------------------------------------------------------------------------

## 21. Development process expectations

Commit in logical increments.

Possible progression:

``` text
chore: initialize frontend and backend
feat: add relational data model and seed data
feat: parse and normalize logger imports
feat: detect temperature incidents and data gaps
feat: add dashboard API
feat: build mobile dashboard
feat: add fridge history and chart
test: cover import and incident edge cases
docs: complete readme and assignment notes
```

Do not manufacture commits solely to make history look impressive.
Commit as the work naturally progresses.

Keep `SPEC.md`, planning notes and useful AI-agent instructions in the
repository because Triolla explicitly wants to see how the work was
approached.

------------------------------------------------------------------------

## 22. Definition of done

The MVP is complete when a reviewer can:

1.  clone the public repository
2.  follow README instructions without creating an account
3.  start frontend + backend locally
4.  get a working local SQLite database
5.  see meaningful seeded/demo data
6.  upload a logger CSV
7.  associate it with logger/branch/fridge context
8.  have readings parsed and normalized
9.  see invalid/duplicate/gap handling
10. see sustained temperature incidents detected
11. see an isolated high spike not incorrectly treated as a sustained
    incident
12. view a mobile-friendly dashboard
13. open a fridge and inspect its temperature history
14. see when a sustained \>5°C incident began and its duration where
    determinable
15. run focused automated tests
16. understand the major assumptions from README/NOTES
17. find a complete `NOTES.md` matching Triolla's requested submission
    format

------------------------------------------------------------------------

# First task --- initialize the project only

Start with foundation work. Do NOT attempt the entire application in one
giant change.

## Task 1 goals

1.  Create the root project/repository structure.
2.  Initialize React + TypeScript + Vite under `frontend`.
3.  Initialize NestJS + TypeScript under `backend`.
4.  Configure a simple root-level npm workspace/scripts if it makes
    local startup easier.
5.  Add Prisma + SQLite to the backend.
6.  Create an initial relational Prisma schema for:
    -   Branch
    -   Fridge
    -   Logger
    -   LoggerAssignment
    -   Import
    -   Reading
    -   Incident
7.  Create the first migration.
8.  Add a seed script with a small representative dataset.
9.  Create initial `README.md`, `NOTES.md`, and keep this `SPEC.md`.
10. Add `.gitignore` and environment example only if actually needed.
11. Verify the frontend and backend both start locally.
12. Verify Prisma can create/seed the local SQLite DB.
13. Add a simple backend health endpoint and a minimal frontend shell so
    startup can be verified.

## Task 1 constraints

Do not yet build:

-   full upload UI
-   parser
-   incident detection
-   chart
-   polished dashboard

We want a clean foundation first.

## Before writing code

Briefly output:

1.  the exact proposed repository tree
2.  the Prisma relationships you intend to create
3.  the root commands the reviewer will eventually use

Check that the plan satisfies local/no-account/no-paid-service
constraints.

Then implement Task 1.

## After Task 1

Report:

-   files created/changed
-   commands to run
-   database schema summary
-   assumptions introduced
-   tests/checks performed
-   anything that failed or remains unresolved

Then STOP and wait for the next task. Do not continue automatically into
parser/dashboard implementation.
