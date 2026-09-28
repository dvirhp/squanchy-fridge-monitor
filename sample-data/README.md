# Sample data

Setup seeds illustrative readings directly from `backend/prisma/seed.ts`.
Task 2 also accepts these standalone logger CSVs through `POST /imports`.
Every CSV contains only time and temperature (except the deliberately unsupported
missing-columns fixture). Logger/branch/fridge metadata is provided separately.

The fixtures include the specification's spike and warming examples, an assumed
Fahrenheit logger, ERR, a gap, a healthy fridge, and TL-0417 moving from Walk-in
to Display 2. Additional names/readings are invented for demonstration.
“Tel Aviv” and “tel aviv” resolve to one branch.

Import filenames beginning with `illustrative-seed-` are provenance labels,
not claims that actual source files were uploaded. Counts reflect the inserted
fixture rows. No incidents or duplicate-import results are fabricated.
The importer reports duplicates within a file and against earlier imports/seeds.

| File | Provenance and purpose | Seed context, where applicable |
| --- | --- | --- |
| `celsius.csv` | Client-derived spike readings from SPEC; invented CSV packaging | Tel Aviv / Walk-in / TL-0417 |
| `fahrenheit-reversed.csv` | Client-derived example numbers, provisional Fahrenheit configuration; invented headers/order | Haifa / Dairy / TL-0231 |
| `invalid-duplicates-gap.csv` | Invented composite of assignment edge cases: ERR, duplicate, invalid time, out-of-order rows and gap | Jerusalem / Dairy / TL-0700 |
| `invented-ashdod.csv` | Entirely invented context and readings proving generalization | Ashdod / Display 7 / LOGGER-9876; CELSIUS, 10-minute interval |
| `missing-columns.csv` | Invented negative fixture; lacks a supported temperature column | Must fail before persistence |

These are representative exports, not actual files supplied by the client.
The Rishon LeZion / Cream cakes / TL-0388 seed keeps the warming readings from SPEC.
Task 3 runs the real historical analyzer after imports and during setup. The spike
is counted separately, warming yields a temperature incident, and ERR/gaps yield
data-quality findings. No incident records are manufactured by the seed.

Uploading client-derived CSVs against their seeded context will report duplicates.
To see new accepted rows, use a new explicit context. For example (PowerShell:
use `curl.exe`):

```bash
curl -X POST http://localhost:3000/imports -F "file=@sample-data/fahrenheit-reversed.csv" -F "loggerExternalId=NEW-F-LOGGER" -F "branch=New branch" -F "fridge=Cabinet" -F "temperatureUnit=FAHRENHEIT" -F "assignmentValidFrom=2026-09-14 00:00"
```

For the mixed-quality file in a new Celsius context, the expected counts are
total 5, accepted 2, invalid 2, duplicates 1. Repeating it yields 5 duplicates.
