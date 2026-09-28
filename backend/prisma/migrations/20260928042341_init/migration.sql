-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Fridge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Fridge_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "Logger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT NOT NULL,
    "temperatureUnit" TEXT NOT NULL DEFAULT 'CELSIUS',
    "expectedIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoggerAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loggerId" TEXT NOT NULL,
    "fridgeId" TEXT NOT NULL,
    "validFrom" TEXT NOT NULL,
    "validTo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoggerAssignment_loggerId_fkey" FOREIGN KEY ("loggerId") REFERENCES "Logger" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "LoggerAssignment_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "Import" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignmentId" TEXT NOT NULL,
    "loggerId" TEXT NOT NULL,
    "fridgeId" TEXT NOT NULL,
    "temperatureUnit" TEXT NOT NULL,
    "expectedIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "originalFilename" TEXT NOT NULL,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "acceptedRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "duplicateRows" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Import_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "LoggerAssignment" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Import_loggerId_fkey" FOREIGN KEY ("loggerId") REFERENCES "Logger" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Import_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "Reading" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "importId" TEXT NOT NULL,
    "loggerId" TEXT NOT NULL,
    "fridgeId" TEXT NOT NULL,
    "recordedAt" TEXT,
    "temperatureCelsius" REAL,
    "rawTimestamp" TEXT NOT NULL,
    "rawTemperature" TEXT NOT NULL,
    "sourceRowNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "validationError" TEXT,
    "deduplicationKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reading_importId_loggerId_fridgeId_fkey" FOREIGN KEY ("importId", "loggerId", "fridgeId") REFERENCES "Import" ("id", "loggerId", "fridgeId") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Reading_loggerId_fkey" FOREIGN KEY ("loggerId") REFERENCES "Logger" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Reading_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fridgeId" TEXT NOT NULL,
    "loggerId" TEXT,
    "type" TEXT NOT NULL,
    "startedAt" TEXT NOT NULL,
    "endedAt" TEXT,
    "durationMinutes" REAL,
    "peakTemperatureCelsius" REAL,
    "details" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Incident_fridgeId_fkey" FOREIGN KEY ("fridgeId") REFERENCES "Fridge" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT "Incident_loggerId_fkey" FOREIGN KEY ("loggerId") REFERENCES "Logger" ("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);

-- CreateIndex
CREATE UNIQUE INDEX "Branch_normalizedName_key" ON "Branch"("normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Fridge_branchId_normalizedName_key" ON "Fridge"("branchId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "Logger_externalId_key" ON "Logger"("externalId");

-- CreateIndex
CREATE INDEX "LoggerAssignment_loggerId_validFrom_idx" ON "LoggerAssignment"("loggerId", "validFrom");

-- CreateIndex
CREATE INDEX "LoggerAssignment_fridgeId_validFrom_idx" ON "LoggerAssignment"("fridgeId", "validFrom");

-- CreateIndex
CREATE INDEX "Import_assignmentId_idx" ON "Import"("assignmentId");

-- CreateIndex
CREATE INDEX "Import_fridgeId_importedAt_idx" ON "Import"("fridgeId", "importedAt");

-- CreateIndex
CREATE INDEX "Import_loggerId_importedAt_idx" ON "Import"("loggerId", "importedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Import_id_loggerId_fridgeId_key" ON "Import"("id", "loggerId", "fridgeId");

-- CreateIndex
CREATE UNIQUE INDEX "Reading_deduplicationKey_key" ON "Reading"("deduplicationKey");

-- CreateIndex
CREATE INDEX "Reading_importId_loggerId_fridgeId_idx" ON "Reading"("importId", "loggerId", "fridgeId");

-- CreateIndex
CREATE INDEX "Reading_fridgeId_recordedAt_idx" ON "Reading"("fridgeId", "recordedAt");

-- CreateIndex
CREATE INDEX "Reading_loggerId_recordedAt_idx" ON "Reading"("loggerId", "recordedAt");

-- CreateIndex
CREATE INDEX "Incident_fridgeId_startedAt_idx" ON "Incident"("fridgeId", "startedAt");

-- CreateIndex
CREATE INDEX "Incident_loggerId_startedAt_idx" ON "Incident"("loggerId", "startedAt");
