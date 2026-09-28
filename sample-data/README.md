# Sample data

Task 1 seeds illustrative readings directly from `backend/prisma/seed.ts`.
No CSV parser or upload workflow exists yet; CSV files will arrive with that task.

The fixtures include the specification's spike and warming examples, an assumed
Fahrenheit logger, ERR, a gap, a healthy fridge, and TL-0417 moving from Walk-in
to Display 2. Additional names/readings are invented for demonstration.
“Tel Aviv” and “tel aviv” resolve to one branch.

Import filenames beginning with `illustrative-seed-` are provenance labels,
not claims that actual source files were uploaded. Counts reflect the inserted
fixture rows. No incidents or duplicate-import results are fabricated.
The foundation test attempts an exact duplicate to verify database rejection;
actual duplicate reporting is deferred until the importer exists.
