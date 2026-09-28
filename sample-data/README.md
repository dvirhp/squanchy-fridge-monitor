# Sample logger files

These representative CSVs are invented export packaging, not actual client files.
They contain only time and temperature; `missing-columns.csv` deliberately replaces
temperature with an unsupported humidity column. Supply logger, branch and fridge
separately in `/upload`. Never add those columns to the logger file.

For each independent example below, choose **New logger**, enter the listed ID,
choose the explicit source unit and interval, then choose **New branch** and
**New fridge** with the listed names. Enter **Logger started here** in branch-local
time. After the first upload, reuse the existing logger/location for repeats.
Counts assume these demo IDs have not already been imported.

| File | Scenario | Logger / branch / fridge | Unit; interval; start | Expected first result |
| --- | --- | --- | --- | --- |
| `celsius.csv` | SPEC's Tel Aviv-style 4.0 → 4.1 → 9.4 → 4.3 spike | DEMO-SPIKE / Upload examples / Walk-in | Celsius; 15 min; 2026-09-14 00:00 | 4 accepted; 1 temporary spike, **0 sustained incidents**; spike visible in chart |
| `gradual-warming.csv` | SPEC's Rishon-style 4.6 → 5.4 → 6.3 → 7.1 warming | DEMO-WARM / Upload examples / Cream cakes | Celsius; 15 min; 2026-09-14 00:00 | 4 accepted; 1 sustained incident, first high 06:15, last high 06:45, peak 7.1°C; ongoing in uploaded data, duration unknown |
| `fahrenheit-reversed.csv` | Haifa-style 38.3 / 39.0 plus an illustrative ERR; reversed `Temp,DateTime` aliases and DD/MM/YYYY | DEMO-FAHRENHEIT / Upload examples / Legacy cabinet | **Fahrenheit**; 15 min; 2026-09-14 00:00 | 2 accepted (3.5°C, approximately 3.89°C), 1 invalid retained; 0 temperature incidents |
| `invalid-duplicates-gap.csv` | Out-of-order rows, equivalent decimal duplicate, ERR, invalid date and gap | DEMO-QUALITY / Upload examples / Dairy | Celsius; 15 min; 2026-09-14 00:00 | Total 5: 2 accepted, 2 invalid, 1 duplicate; 1 gap (06:15–08:30, 135 min), 2 invalid findings including one date unknown |
| `invented-ashdod.csv` | Healthy Celsius readings; entirely unseen entities; reversed columns, mixed date formats and unsorted rows | LOGGER-9876 / Ashdod / Display 7 | Celsius; **10 min**; **2031-02-03 00:00** | 2 accepted (3.8°C then 4.1°C); no findings |
| `missing-columns.csv` | Structural rejection | DEMO-REJECT / Rejected example / Cabinet | Celsius; 15 min; 2026-09-14 00:00 | Actionable missing-temperature error; no entities, readings or import saved |

After creating `Upload examples`, select it from the existing branch list for the
other examples. Repeating each valid file adds no readings: respectively 4, 4, 3,
5 and 2 duplicates. Invalid counts describe newly retained rows, so repeats show
zero new invalid rows. The UI shows accumulated findings for affected fridges;
temporary spikes are visible in the chart, not persisted as sustained incidents.

For historical inspection, select 2026-09-14 for the first four files and 2031-02-03
for Ashdod. Date-unknown evidence stays visible in fridge details but cannot make a
selected period a dashboard data-quality problem. Durations are sampling-based;
the warming sample has no observed recovery, so no complete duration can be stated.

## Demonstrate a deliberate logger move

Reuse existing files rather than inventing a combined location spreadsheet:

1. Upload `celsius.csv` with new logger **DEMO-MOVE**, **Celsius**, **15-minute**
   interval, new branch **Move example**, fridge **Walk-in**, and start
   **2026-09-14 00:00**. Expect 4 accepted and no sustained incident.
2. Upload `invented-ashdod.csv` using existing **DEMO-MOVE**, existing **Move example**,
   and new fridge **Display 2**. Choose **Start using this logger here / move it here**
   and enter **2031-02-03 00:00**. Keep the existing logger's 15-minute configuration;
   the file's two readings are only 10 minutes apart and remain continuous.
   Expect 2 accepted, no findings.
3. Open both fridge histories. Walk-in retains its four 2026 readings; Display 2
   has only the two 2031 readings. No gap or chart line spans the placement boundary.
4. Reupload `celsius.csv` using **DEMO-MOVE**, **Move example / Walk-in**, and
   **Use the recorded location history**. Expect 4 duplicates; historical ownership
   stays unchanged even though the logger's latest location is Display 2.

This mirrors the Tel Aviv move without modifying the seeded TL-0417 example.
Files spanning two placements must be split; contradictory/backdated moves fail.

## Seed and workload evidence

Setup seeds 15 illustrative readings from `backend/prisma/seed.ts`, including the
original warming/spike examples, healthy Fahrenheit readings, ERR/gap evidence,
and TL-0417 moving from Tel Aviv / Walk-in to Display 2. Branch casing is normalized.
The real analyzer derives findings; no incidents are fabricated by the seed.
`illustrative-seed-` filenames are provenance labels, not uploaded source files.

Uploading `celsius.csv` or `gradual-warming.csv` against their matching seeded
logger/fridge yields 4 duplicates. `fahrenheit-reversed.csv` against Haifa / Dairy /
TL-0231 yields 2 duplicates and 1 newly retained ERR (the ERR is additional to the seed).
Fahrenheit remains an explicit provisional configuration to confirm with Summer;
temperature values never determine units.

The generated **3,000-row** path is in
[`backend/test/imports.test.ts`](../backend/test/imports.test.ts), test
`representative 3000-row weekly import persists every row within one transaction`.
It imports 3,000 distinct readings with an explicit one-minute interval, checks
every row was saved and asserts zero incidents. Run `npm test`; no large redundant
CSV is needed. The same test file covers branch-case matching, cross-import
deduplication, unseen contexts, moves and transaction rollback.
