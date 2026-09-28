-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fridgeId" TEXT NOT NULL,
    "loggerId" TEXT,
    "type" TEXT NOT NULL,
    "startedAt" TEXT,
    "endedAt" TEXT,
    "durationMinutes" REAL,
    "peakTemperatureCelsius" REAL,
    "details" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Incident_loggerId_fkey" FOREIGN KEY ("loggerId") REFERENCES "Logger" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
INSERT INTO "new_Incident" ("createdAt", "details", "durationMinutes", "endedAt", "fridgeId", "id", "loggerId", "peakTemperatureCelsius", "startedAt", "type", "updatedAt") SELECT "createdAt", "details", "durationMinutes", "endedAt", "fridgeId", "id", "loggerId", "peakTemperatureCelsius", "startedAt", "type", "updatedAt" FROM "Incident";
DROP TABLE "Incident";
ALTER TABLE "new_Incident" RENAME TO "Incident";
CREATE INDEX "Incident_fridgeId_startedAt_idx" ON "Incident"("fridgeId", "startedAt");
CREATE INDEX "Incident_loggerId_startedAt_idx" ON "Incident"("loggerId", "startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
