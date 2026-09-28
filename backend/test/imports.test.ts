import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/prisma/prisma.service';
import { ImportsService } from '../src/imports/imports.service';
import { ImportDto } from '../src/imports/import.dto';
import { AnalysisService } from '../src/analysis/analysis.service';

const directory = mkdtempSync(join(tmpdir(), 'squanchy-imports-'));
const url = 'file:' + join(directory, 'test.db').replaceAll('\\', '/');
const prisma = new PrismaService({ datasources: { db: { url } } });
const service = new ImportsService(prisma, new AnalysisService());
const fixture = (name: string) => readFileSync(join('..', 'sample-data', name));
const csv = (rows: string) => Buffer.from('Time,Temperature\n' + rows);
const context: ImportDto = {
  branch: 'Ashdod',
  fridge: 'Display 7',
  loggerExternalId: 'LOGGER-9876',
  temperatureUnit: 'CELSIUS',
  expectedIntervalMinutes: 10,
  assignmentValidFrom: '2031-02-03 00:00',
};
const run = (entry: string, args: string[]) =>
  execFileSync(
    process.execPath,
    [
      entry === 'prisma'
        ? join(dirname(require.resolve('prisma/package.json')), 'build/index.js')
        : require.resolve(entry),
      ...args,
    ],
    { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' },
  );
const counts = async () =>
  Promise.all([
    prisma.branch.count(),
    prisma.fridge.count(),
    prisma.logger.count(),
    prisma.loggerAssignment.count(),
    prisma.import.count(),
    prisma.reading.count(),
    prisma.incident.count(),
  ]);
before(async () => {
  run('tsx/cli', ['prisma/prepare.ts']);
  run('prisma', ['migrate', 'deploy']);
  run('tsx/cli', ['prisma/seed.ts']);
  await prisma.$connect();
});
after(async () => {
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

test('unseen Ashdod context creates generic entities and sorted normalized readings, then deduplicates a repeat', async () => {
  const first = await service.importCsv(
    fixture('invented-ashdod.csv'),
    'arbitrary-name.csv',
    context,
  );
  assert.equal(first.acceptedRows, 2);
  assert.equal(first.totalRows, 2);
  const imported = await prisma.import.findUniqueOrThrow({
    where: { id: first.importId },
    include: { fridge: { include: { branch: true } }, logger: true },
  });
  assert.equal(imported.fridge.name, 'Display 7');
  assert.equal(imported.fridge.branch.name, 'Ashdod');
  assert.equal(imported.logger.externalId, 'LOGGER-9876');
  assert.equal(imported.temperatureUnit, 'CELSIUS');
  assert.equal(imported.expectedIntervalMinutes, 10);
  const readings = await prisma.reading.findMany({
    where: { importId: first.importId },
    orderBy: { recordedAt: 'asc' },
  });
  assert.deepEqual(
    readings.map((r) => r.recordedAt),
    ['2031-02-03T07:00:00', '2031-02-03T07:10:00'],
  );
  assert.deepEqual(
    readings.map((r) => r.sourceRowNumber),
    [3, 2],
  );
  assert.deepEqual(
    readings.map((r) => r.temperatureCelsius),
    [3.8, 4.1],
  );
  assert.ok(
    readings.every((r) => r.loggerId === imported.loggerId && r.fridgeId === imported.fridgeId),
  );
  const second = await service.importCsv(fixture('invented-ashdod.csv'), 'renamed.csv', {
    ...context,
    branch: 'ashdod',
    fridge: 'display 7',
  });
  assert.equal(second.duplicateRows, 2);
  assert.equal(second.acceptedRows, 0);
  assert.equal(await prisma.branch.count({ where: { normalizedName: 'ashdod' } }), 1);
  assert.equal(await prisma.reading.count({ where: { loggerId: imported.loggerId } }), 2);
});

test('within-file duplicates and invalid rows partition counts and retain raw data', async () => {
  const input = csv(
    '2032-01-01 00:00,4.1\n2032-01-01 00:00,4.10\n2032-01-01 00:15,ERR\nbad-date,4.2\n2032-01-01 00:15,ERR',
  );
  const metadata: ImportDto = {
    branch: 'Unseen quality branch',
    fridge: 'Shelf',
    loggerExternalId: 'NEW-QUALITY',
    temperatureUnit: 'CELSIUS',
    assignmentValidFrom: '2032-01-01 00:00',
  };
  const result = await service.importCsv(input, 'quality.csv', metadata);
  assert.deepEqual(
    [result.totalRows, result.acceptedRows, result.invalidRows, result.duplicateRows],
    [5, 1, 2, 2],
  );
  const rows = await prisma.reading.findMany({ where: { importId: result.importId } });
  assert.equal(rows.find((r) => r.rawTemperature === 'ERR')!.temperatureCelsius, null);
  assert.equal(rows.find((r) => r.rawTimestamp === 'bad-date')!.recordedAt, null);
  assert.ok(rows.filter((r) => r.status === 'INVALID').every((r) => r.validationError));
  const again = await service.importCsv(input, 'again.csv', metadata);
  assert.deepEqual([again.acceptedRows, again.invalidRows, again.duplicateRows], [0, 0, 5]);
});

test('Fahrenheit is configuration driven in an invented branch with reversed columns', async () => {
  const result = await service.importCsv(
    Buffer.from('Temp,DateTime\n38.3,04/05/2033 06:00'),
    'anything.csv',
    {
      branch: 'New Fahrenheit Branch',
      fridge: 'Cabinet 9',
      loggerExternalId: 'ANY-F-LOGGER',
      temperatureUnit: 'FAHRENHEIT',
      assignmentValidFrom: '2033-05-04 00:00',
    },
  );
  const reading = await prisma.reading.findFirstOrThrow({ where: { importId: result.importId } });
  assert.ok(Math.abs(reading.temperatureCelsius! - 3.5) < 1e-12);
  assert.equal(reading.rawTemperature, '38.3');
});

test('seed readings and imported readings share canonical identity including Fahrenheit', async () => {
  const result = await service.importCsv(fixture('fahrenheit-reversed.csv'), 'unrelated.csv', {
    branch: 'Haifa',
    fridge: 'Dairy',
    loggerExternalId: 'TL-0231',
  });
  assert.deepEqual([result.acceptedRows, result.duplicateRows], [0, 2]);
});

test('structural failure creates no entities, assignments, imports or readings', async () => {
  for (const input of [
    fixture('missing-columns.csv'),
    Buffer.from('Time,Timestamp,Temp\na,a,4'),
    Buffer.from('Time,Temp\n2031-01-01 00:00,4\n"unterminated,5'),
  ]) {
    const before = await counts();
    await assert.rejects(
      service.importCsv(input, 'bad.csv', { ...context, branch: 'Must not exist' }),
    );
    assert.deepEqual(await counts(), before);
  }
});

test('new logger needs explicit configuration; failed context resolution rolls back all writes', async () => {
  for (const metadata of [
    { branch: 'Rollback', fridge: 'One', loggerExternalId: 'NO-UNIT' },
    {
      branch: 'Rollback',
      fridge: 'One',
      loggerExternalId: 'NO-START',
      temperatureUnit: 'CELSIUS' as const,
    },
    {
      branch: 'Rollback',
      fridge: 'One',
      loggerExternalId: 'BAD-START',
      temperatureUnit: 'CELSIUS' as const,
      assignmentValidFrom: 'bad',
    },
  ]) {
    const before = await counts();
    await assert.rejects(service.importCsv(csv('2034-01-01 00:00,4'), 'a.csv', metadata));
    assert.deepEqual(await counts(), before);
  }
});

test('generic logger movement preserves old ownership, permits historical import, and rejects spanning or contradictory moves', async () => {
  const base: ImportDto = {
    branch: 'Move Branch',
    fridge: 'Original',
    loggerExternalId: 'MOBILE-NEW',
    temperatureUnit: 'CELSIUS',
    assignmentValidFrom: '2035-01-01 00:00',
  };
  const original = await service.importCsv(csv('2035-01-01 06:00,4'), 'old.csv', base);
  const moved = await service.importCsv(csv('2035-01-02 06:00,4.2'), 'new.csv', {
    ...base,
    fridge: 'New home',
    assignmentValidFrom: '2035-01-02 00:00',
  });
  const oldImport = await prisma.import.findUniqueOrThrow({ where: { id: original.importId } });
  const newImport = await prisma.import.findUniqueOrThrow({ where: { id: moved.importId } });
  assert.notEqual(oldImport.fridgeId, newImport.fridgeId);
  assert.equal(
    (await prisma.reading.findFirstOrThrow({ where: { importId: original.importId } })).fridgeId,
    oldImport.fridgeId,
  );
  assert.equal(
    (await prisma.loggerAssignment.findUniqueOrThrow({ where: { id: original.assignmentId } }))
      .validTo,
    '2035-01-02T00:00:00',
  );
  const historical = await service.importCsv(csv('2035-01-01 07:00,3.9'), 'late.csv', {
    ...base,
    assignmentValidFrom: undefined,
  });
  assert.equal(historical.assignmentId, original.assignmentId);
  const before = await counts();
  await assert.rejects(
    service.importCsv(csv('2035-01-01 07:00,3.9\n2035-01-02 07:00,4'), 'spanning.csv', {
      ...base,
      assignmentValidFrom: undefined,
    }),
  );
  await assert.rejects(
    service.importCsv(csv('2035-01-02 05:00,4'), 'conflict.csv', {
      ...base,
      fridge: 'Third',
      assignmentValidFrom: '2035-01-02 04:00',
    }),
    /contradict/,
  );
  assert.deepEqual(await counts(), before);
});

test('all-invalid timestamps require explicit assignment and do not guess ownership', async () => {
  const before = await counts();
  await assert.rejects(
    service.importCsv(csv('bad,ERR'), 'bad-times.csv', {
      ...context,
      assignmentValidFrom: undefined,
    }),
    /assignmentId/,
  );
  assert.deepEqual(await counts(), before);
  const assignment = await prisma.loggerAssignment.findFirstOrThrow({
    where: { logger: { externalId: context.loggerExternalId } },
  });
  const result = await service.importCsv(csv('bad,ERR'), 'bad-times.csv', {
    ...context,
    assignmentValidFrom: undefined,
    assignmentId: assignment.id,
  });
  assert.equal(result.invalidRows, 1);
});

test('existing logger configuration cannot be silently changed', async () => {
  const before = await counts();
  await assert.rejects(
    service.importCsv(fixture('invented-ashdod.csv'), 'a.csv', {
      ...context,
      temperatureUnit: 'FAHRENHEIT',
    }),
    /configuration/,
  );
  assert.deepEqual(await counts(), before);
});

test('DTO accepts explicit new context, trims names, and rejects invalid metadata', async () => {
  const good = plainToInstance(ImportDto, {
    ...context,
    branch: ' Ashdod ',
    expectedIntervalMinutes: '10',
  });
  assert.equal((await validate(good)).length, 0);
  assert.equal(good.branch, 'Ashdod');
  const bad = plainToInstance(ImportDto, {
    branch: ' ',
    fridge: 'A',
    loggerExternalId: 'B',
    temperatureUnit: 'GUESS',
    expectedIntervalMinutes: 'zero',
  });
  assert.ok((await validate(bad)).length >= 3);
});

test('representative 3000-row weekly import persists every row within one transaction', async () => {
  const rows = Array.from({ length: 3000 }, (_, index) => {
    const day = String(1 + Math.floor(index / 1440)).padStart(2, '0');
    const hour = String(Math.floor((index % 1440) / 60)).padStart(2, '0');
    const minute = String(index % 60).padStart(2, '0');
    return `2036-06-${day} ${hour}:${minute},4.1`;
  }).join('\n');
  const result = await service.importCsv(csv(rows), 'weekly.csv', {
    branch: 'Weekly New Branch',
    fridge: 'Weekly Cabinet',
    loggerExternalId: 'WEEKLY-NEW',
    temperatureUnit: 'CELSIUS',
    expectedIntervalMinutes: 1,
    assignmentValidFrom: '2036-06-01 00:00',
  });
  assert.equal(result.acceptedRows, 3000);
  assert.equal(await prisma.reading.count({ where: { importId: result.importId } }), 3000);
  assert.equal(
    await prisma.incident.count({ where: { fridge: { normalizedName: 'weekly cabinet' } } }),
    0,
  );
});
