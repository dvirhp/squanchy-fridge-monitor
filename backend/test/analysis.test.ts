import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { AnalysisService } from '../src/analysis/analysis.service';
import { ImportsService } from '../src/imports/imports.service';
import type { ImportDto } from '../src/imports/import.dto';

const directory = mkdtempSync(join(tmpdir(), 'squanchy-analysis-'));
const url = 'file:' + join(directory, 'test.db').replaceAll('\\', '/');
const prisma = new PrismaService({ datasources: { db: { url } } });
const analysis = new AnalysisService();
const imports = new ImportsService(prisma, analysis);
const csv = (rows: string) => Buffer.from('Time,Temperature\n' + rows);
const metadata = (key: string, interval = 15): ImportDto => ({
  branch: 'Invented Analysis Branch ' + key,
  fridge: 'Cabinet ' + key,
  loggerExternalId: 'ANALYSIS-' + key,
  temperatureUnit: 'CELSIUS',
  expectedIntervalMinutes: interval,
  assignmentValidFrom: '2042-03-01 00:00',
});
const load = (fridgeId: string) =>
  prisma.incident.findMany({
    where: { fridgeId },
    orderBy: [{ startedAt: 'asc' }, { type: 'asc' }],
  });
const logical = async (fridgeId: string) =>
  (await load(fridgeId))
    .map(({ id, createdAt, updatedAt, ...content }) => JSON.stringify(content))
    .sort();
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
before(async () => {
  run('tsx/cli', ['prisma/prepare.ts']);
  run('prisma', ['migrate', 'deploy']);
  await prisma.$connect();
});
after(async () => {
  await prisma.$disconnect();
  rmSync(directory, { recursive: true, force: true });
});

test('cross-import highs form one incident; later recovery closes it; repeats preserve logical findings', async () => {
  const context = metadata('CUMULATIVE');
  const first = await imports.importCsv(
    csv('2042-03-01 06:00,4.8\n2042-03-01 06:15,5.4'),
    'first.csv',
    context,
  );
  const fridgeId = first.analysis.fridgeIds[0];
  assert.equal((await load(fridgeId)).length, 0);
  const secondCsv = csv('2042-03-01 06:30,6.3\n2042-03-01 06:45,7.1');
  await imports.importCsv(secondCsv, 'second.csv', context);
  let findings = await load(fridgeId);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].startedAt, '2042-03-01T06:15:00');
  assert.equal((findings[0].details as Record<string, unknown>).state, 'ONGOING');
  assert.equal(findings[0].peakTemperatureCelsius, 7.1);
  await imports.importCsv(csv('2042-03-01 07:00,4.8'), 'recovery.csv', context);
  findings = await load(fridgeId);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].endedAt, '2042-03-01T07:00:00');
  assert.equal(findings[0].durationMinutes, 45);
  assert.equal((findings[0].details as Record<string, unknown>).state, 'RECOVERED');
  const expected = await logical(fridgeId);
  await prisma.$transaction((tx) => analysis.recomputeFridges(tx, [fridgeId]));
  assert.deepEqual(await logical(fridgeId), expected);
  const repeat = await imports.importCsv(secondCsv, 'renamed.csv', context);
  assert.equal(repeat.duplicateRows, 2);
  assert.deepEqual(await logical(fridgeId), expected);
});

test('late historical readings remove a gap and merge runs; late recovery splits the resulting history', async () => {
  const context = metadata('LATE');
  const first = await imports.importCsv(
    csv('2042-03-01 06:00,6\n2042-03-01 06:45,7\n2042-03-01 07:00,8'),
    'initial.csv',
    context,
  );
  const fridgeId = first.analysis.fridgeIds[0];
  assert.equal(first.analysis.dataGaps, 1);
  assert.equal(first.analysis.temperatureIncidents, 1);
  await imports.importCsv(csv('2042-03-01 06:30,6.5\n2042-03-01 06:15,6.2'), 'late.csv', context);
  let findings = await load(fridgeId);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].startedAt, '2042-03-01T06:00:00');
  await imports.importCsv(csv('2042-03-01 06:20,4'), 'late-recovery.csv', context);
  findings = await load(fridgeId);
  assert.equal(findings.length, 2);
  assert.deepEqual(
    findings.map((row) => row.durationMinutes),
    [20, null],
  );
  assert.equal(findings[1].startedAt, '2042-03-01T06:30:00');
});

test('invented custom-interval history uses import snapshots despite later logger configuration changes', async () => {
  const context = metadata('CUSTOM', 7);
  const result = await imports.importCsv(
    csv('2042-03-01 06:00,6\n2042-03-01 06:07,7\n2042-03-01 06:22,4'),
    'custom.csv',
    context,
  );
  const fridgeId = result.analysis.fridgeIds[0];
  assert.equal(result.analysis.dataGaps, 1);
  const before = await logical(fridgeId);
  await prisma.logger.update({
    where: { externalId: context.loggerExternalId },
    data: { expectedIntervalMinutes: 60 },
  });
  await prisma.$transaction((tx) => analysis.recomputeFridges(tx, [fridgeId]));
  assert.deepEqual(await logical(fridgeId), before);
  const temperature = (await load(fridgeId)).find((row) => row.type === 'TEMPERATURE')!;
  assert.equal((temperature.details as Record<string, unknown>).state, 'INTERRUPTED');
  assert.equal(temperature.durationMinutes, null);
});

test('undated invalid readings persist null dates without suppressing recovered incidents', async () => {
  const result = await imports.importCsv(
    csv('2042-03-01 06:00,6\n2042-03-01 06:15,7\n2042-03-01 06:30,4\nunknown,ERR'),
    'undated.csv',
    metadata('UNDATED'),
  );
  const findings = await load(result.analysis.fridgeIds[0]);
  assert.equal(findings.length, 2);
  const invalid = findings.find((row) => row.type === 'INVALID_READING')!;
  assert.equal(invalid.startedAt, null);
  assert.equal(invalid.endedAt, null);
  assert.equal(findings.find((row) => row.type === 'TEMPERATURE')!.durationMinutes, 30);
});

test('logger moves recompute previous fridge, preserve ownership, and isolate a return to the same fridge', async () => {
  const context = metadata('MOVE', 10);
  const old = await imports.importCsv(
    csv('2042-03-01 00:00,6\n2042-03-01 00:10,7'),
    'old.csv',
    context,
  );
  const originalFridge = old.analysis.fridgeIds[0];
  const moved = await imports.importCsv(csv('2042-03-01 00:15,6'), 'move.csv', {
    ...context,
    fridge: 'Other cabinet',
    assignmentValidFrom: '2042-03-01 00:15',
  });
  assert.ok(moved.analysis.fridgeIds.includes(originalFridge));
  const oldIncident = (await load(originalFridge))[0];
  assert.equal((oldIncident.details as Record<string, unknown>).state, 'INTERRUPTED');
  assert.equal(
    (oldIncident.details as Record<string, unknown>).interruptionReason,
    'ASSIGNMENT_ENDED',
  );
  const returned = await imports.importCsv(csv('2042-03-01 00:20,8'), 'return.csv', {
    ...context,
    assignmentValidFrom: '2042-03-01 00:20',
  });
  assert.equal((await load(originalFridge)).length, 1);
  assert.equal((await load(originalFridge))[0].peakTemperatureCelsius, 7);
  assert.notEqual(returned.assignmentId, old.assignmentId);
  const oldImport = await prisma.import.findUniqueOrThrow({ where: { id: old.importId } });
  assert.equal(oldImport.fridgeId, originalFridge);
  // An assignment's current fridge field is not authoritative historical ownership.
  const other = await prisma.import.findUniqueOrThrow({ where: { id: moved.importId } });
  await prisma.loggerAssignment.update({
    where: { id: old.assignmentId },
    data: { fridgeId: other.fridgeId },
  });
  await prisma.$transaction((tx) => analysis.recomputeFridges(tx, [originalFridge]));
  assert.equal((await load(originalFridge))[0].fridgeId, originalFridge);
});

test('historical incidents preserve dates and can be selected by overlap with a later range', async () => {
  const result = await imports.importCsv(
    csv('2042-03-01 23:50,6\n2042-03-02 00:00,7\n2042-03-02 00:10,4'),
    'midnight.csv',
    metadata('DATES', 10),
  );
  const matches = await prisma.incident.findMany({
    where: {
      fridgeId: result.analysis.fridgeIds[0],
      startedAt: { lt: '2042-03-03T00:00:00' },
      endedAt: { gte: '2042-03-02T00:00:00' },
    },
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].startedAt, '2042-03-01T23:50:00');
  assert.equal(matches[0].durationMinutes, 20);
});

test('analysis failure rolls back readings, import, and deletion/replacement of previous findings', async () => {
  const context = metadata('ROLLBACK');
  const original = await imports.importCsv(
    csv('2042-03-01 06:00,6\n2042-03-01 06:15,7'),
    'original.csv',
    context,
  );
  const fridgeId = original.analysis.fridgeIds[0];
  const before = await load(fridgeId);
  const countBefore = await Promise.all([prisma.import.count(), prisma.reading.count()]);
  class FailingAnalysis extends AnalysisService {
    override async recomputeFridges(tx: Prisma.TransactionClient, ids: string[]): Promise<never> {
      await super.recomputeFridges(tx, ids);
      throw new Error('Simulated failure after replacing findings');
    }
  }
  const failing = new ImportsService(prisma, new FailingAnalysis());
  await assert.rejects(
    failing.importCsv(csv('2042-03-01 06:30,4'), 'failed.csv', context),
    /Simulated failure/,
  );
  assert.deepEqual(await load(fridgeId), before);
  assert.deepEqual(await Promise.all([prisma.import.count(), prisma.reading.count()]), countBefore);
});

test('recomputing one fridge leaves unrelated findings untouched', async () => {
  const first = await imports.importCsv(
    csv('2042-03-01 06:00,6\n2042-03-01 06:15,7'),
    'one.csv',
    metadata('SCOPE-ONE'),
  );
  const second = await imports.importCsv(
    csv('2042-03-01 06:00,6\n2042-03-01 06:15,7'),
    'two.csv',
    metadata('SCOPE-TWO'),
  );
  const before = await load(second.analysis.fridgeIds[0]);
  await prisma.$transaction((tx) => analysis.recomputeFridges(tx, first.analysis.fridgeIds));
  assert.deepEqual(await load(second.analysis.fridgeIds[0]), before);
});
