import 'dotenv/config';
import { PrismaClient, TemperatureUnit } from '@prisma/client';

const prisma = new PrismaClient();

// Illustrative fixtures, explicitly normalized by hand. This is not an import parser.
const scenarios = [
  { key: 'spike', branch: 'Tel Aviv', fridge: 'Walk-in', logger: 'TL-0417',
    from: '2026-09-14T00:00:00', to: '2026-09-15T00:00:00',
    rows: [
      ['2026-09-14T05:45:00', '2026-09-14 05:45', '4.0', 4],
      ['2026-09-14T06:00:00', '2026-09-14 06:00', '4.1', 4.1],
      ['2026-09-14T06:15:00', '2026-09-14 06:15', '9.4', 9.4],
      ['2026-09-14T06:30:00', '2026-09-14 06:30', '4.3', 4.3],
    ] },
  { key: 'moved', branch: 'tel aviv', fridge: 'Display 2', logger: 'TL-0417',
    from: '2026-09-15T00:00:00', to: null,
    rows: [
      ['2026-09-15T06:00:00', '2026-09-15 06:00', '3.8', 3.8],
      ['2026-09-15T06:15:00', '2026-09-15 06:15', '3.9', 3.9],
    ] },
  { key: 'warming', branch: 'Rishon LeZion', fridge: 'Cream cakes', logger: 'TL-0500',
    from: '2026-09-14T00:00:00', to: null,
    rows: [
      ['2026-09-14T06:00:00', '2026-09-14 06:00', '4.6', 4.6],
      ['2026-09-14T06:15:00', '2026-09-14 06:15', '5.4', 5.4],
      ['2026-09-14T06:30:00', '2026-09-14 06:30', '6.3', 6.3],
      ['2026-09-14T06:45:00', '2026-09-14 06:45', '7.1', 7.1],
    ] },
  { key: 'fahrenheit', branch: 'Haifa', fridge: 'Pastries', logger: 'TL-0600',
    unit: TemperatureUnit.FAHRENHEIT, from: '2026-09-14T00:00:00', to: null,
    rows: [
      ['2026-09-14T06:00:00', '14/09/2026 06:00', '38.3', 3.5],
      ['2026-09-14T06:15:00', '14/09/2026 06:15', '39.0', 3.888888888888889],
    ] },
  { key: 'gap-invalid', branch: 'Jerusalem', fridge: 'Dairy', logger: 'TL-0700',
    from: '2026-09-14T00:00:00', to: null,
    rows: [
      ['2026-09-14T06:00:00', '14/09/2026 06:00', '3.7', 3.7],
      ['2026-09-14T06:15:00', '14/09/2026 06:15', 'ERR', null],
      ['2026-09-14T08:30:00', '14/09/2026 08:30', '4.0', 4],
    ] },
] satisfies Array<{
  key: string; branch: string; fridge: string; logger: string;
  unit?: TemperatureUnit; from: string; to: string | null;
  rows: Array<[string, string, string, number | null]>;
}>;

async function main() {
  await prisma.$transaction(async tx => {
    for (const scenario of scenarios) {
      const branch = await tx.branch.upsert({
        where: { normalizedName: scenario.branch.trim().toLowerCase() },
        create: { name: scenario.branch, normalizedName: scenario.branch.trim().toLowerCase() },
        update: {},
      });
      const fridge = await tx.fridge.upsert({
        where: { branchId_normalizedName: { branchId: branch.id, normalizedName: scenario.fridge.toLowerCase() } },
        create: { name: scenario.fridge, normalizedName: scenario.fridge.toLowerCase(), branchId: branch.id },
        update: {},
      });
      const logger = await tx.logger.upsert({
        where: { externalId: scenario.logger },
        create: { externalId: scenario.logger, temperatureUnit: scenario.unit ?? 'CELSIUS' },
        update: {},
      });
      const assignmentId = 'demo-assignment-' + scenario.key;
      await tx.loggerAssignment.upsert({
        where: { id: assignmentId },
        create: { id: assignmentId, loggerId: logger.id, fridgeId: fridge.id, validFrom: scenario.from, validTo: scenario.to },
        update: {},
      });
      const importId = 'demo-import-' + scenario.key;
      const invalidRows = scenario.rows.filter(row => row[3] === null).length;
      await tx.import.upsert({
        where: { id: importId },
        create: {
          id: importId, assignmentId, loggerId: logger.id, fridgeId: fridge.id,
          temperatureUnit: scenario.unit ?? 'CELSIUS',
          originalFilename: 'illustrative-seed-' + scenario.key + '.csv',
          totalRows: scenario.rows.length, acceptedRows: scenario.rows.length - invalidRows, invalidRows,
        },
        update: {},
      });
      for (const [index, [recordedAt, rawTimestamp, rawTemperature, temperatureCelsius]] of scenario.rows.entries()) {
        await tx.reading.upsert({
          where: { id: 'demo-reading-' + scenario.key + '-' + index },
          create: {
            id: 'demo-reading-' + scenario.key + '-' + index,
            importId, loggerId: logger.id, fridgeId: fridge.id, recordedAt,
            rawTimestamp, rawTemperature, temperatureCelsius, sourceRowNumber: index + 2,
            status: temperatureCelsius === null ? 'INVALID' : 'VALID',
            validationError: temperatureCelsius === null ? 'Logger reported ERR' : null,
            // Seed-only stable keys; the real importer will define canonical deduplication.
            deduplicationKey: JSON.stringify([logger.id, recordedAt, temperatureCelsius ?? rawTemperature]),
          },
          update: {},
        });
      }
    }
  });
  console.log('Seed ready: 4 branches, 5 fridges, 4 loggers, 15 readings; no incidents seeded.');
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
