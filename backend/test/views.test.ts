import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaService } from '../src/prisma/prisma.service';
import { AnalysisService } from '../src/analysis/analysis.service';
import { ImportsService } from '../src/imports/imports.service';
import { ViewsService } from '../src/views/views.service';
import { dateBounds } from '../src/views/history-query.dto';

const directory = mkdtempSync(join(tmpdir(), 'squanchy-views-'));
const url = 'file:' + join(directory, 'test.db').replaceAll('\\', '/');
const prisma = new PrismaService({ datasources: { db: { url } } });
const imports = new ImportsService(prisma, new AnalysisService());
const views = new ViewsService(prisma);
const csv = (rows: string) => Buffer.from('Time,Temperature\n' + rows);
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

test('accumulated reads, overlap filters, undated evidence, no-data and overlapping status counts', async () => {
  const context = {
    branch: 'New bakery',
    fridge: 'Cooler',
    loggerExternalId: 'VIEW-1',
    temperatureUnit: 'CELSIUS' as const,
    assignmentValidFrom: '2040-01-01 00:00',
  };
  const first = await imports.importCsv(
    csv('2040-01-01 23:45,6\n2040-01-02 00:00,7\nbad,ERR'),
    'first.csv',
    context,
  );
  await imports.importCsv(csv('2040-01-02 00:15,4'), 'second.csv', context);
  const detail = await views.fridge(first.fridgeId, { from: '2040-01-02', to: '2040-01-02' });
  assert.equal(detail.readings.length, 2);
  assert.equal(detail.temperatureIncidents.length, 1);
  assert.equal(detail.temperatureIncidents[0].startedAt, '2040-01-01T23:45:00');
  assert.equal(detail.temperatureIncidents[0].durationMinutes, 30);
  assert.equal(detail.undatedQuality.length, 1);
  assert.equal(detail.readings[0].assignmentId, first.assignmentId);
  assert.equal(detail.readings[0].expectedIntervalMinutes, 15);
  const branch = await prisma.branch.findFirstOrThrow();
  await prisma.fridge.create({
    data: { name: 'Unused', normalizedName: 'unused', branchId: branch.id },
  });
  const dashboard = await views.dashboard({ status: 'quality', branchId: branch.id });
  assert.deepEqual(dashboard.counts, { total: 2, temperature: 1, quality: 1, clear: 0, noData: 1 });
  assert.equal(dashboard.fridges.length, 1);
  assert.equal(dashboard.fridges[0].status, 'temperature');
  const future = await views.fridge(first.fridgeId, { from: '2050-01-01' });
  assert.equal(future.temperatureIncidents.length, 0);
  assert.equal(future.readings.length, 0);
  assert.equal(future.undatedQuality.length, 1);
});
test('logger moves preserve historical ownership and ongoing findings have a finite observed date range', async () => {
  const context = {
    branch: 'Move bakery',
    fridge: 'Original',
    loggerExternalId: 'VIEW-MOVE',
    temperatureUnit: 'CELSIUS' as const,
    assignmentValidFrom: '2041-01-01 00:00',
  };
  const original = await imports.importCsv(
    csv('2041-01-01 06:00,6\n2041-01-01 06:15,7'),
    'old.csv',
    context,
  );
  assert.equal(
    (await views.fridge(original.fridgeId, { from: '2041-01-02' })).temperatureIncidents.length,
    0,
  );
  const moved = await imports.importCsv(csv('2041-01-02 06:00,4'), 'new.csv', {
    ...context,
    fridge: 'Next',
    assignmentValidFrom: '2041-01-02 00:00',
  });
  const old = await views.fridge(original.fridgeId, {}),
    next = await views.fridge(moved.fridgeId, {});
  assert.equal(old.readings.length, 2);
  assert.equal(next.readings.length, 1);
  assert.equal(
    (old.temperatureIncidents[0].details as Record<string, unknown>).state,
    'INTERRUPTED',
  );
  assert.notEqual(old.readings[0].assignmentId, next.readings[0].assignmentId);
  assert.equal((await views.dashboard({})).fridges[0].status, 'temperature');
  const options = await views.options();
  assert.equal(
    options.loggers.find((l) => l.externalId === context.loggerExternalId)?.assignments.length,
    2,
  );
});
test('rejects impossible/reversed dates and unknown fridge IDs', async () => {
  assert.throws(() => dateBounds({ from: '2040-02-30' }), /valid calendar date/);
  assert.throws(() => dateBounds({ from: '2040-02-02', to: '2040-02-01' }), /Start date/);
  await assert.rejects(views.fridge('missing', {}), /Fridge not found/);
});

test('undated evidence stays visible but only contributes to quality status and counts without a date range', async () => {
  const context = {
    branch: 'Unknown date bakery',
    fridge: 'Counter',
    loggerExternalId: 'VIEW-UNDATED',
    temperatureUnit: 'CELSIUS' as const,
    assignmentValidFrom: '2042-01-01 00:00',
  };
  const imported = await imports.importCsv(
    csv('2042-01-02 06:00,4\nbad-date,ERR'),
    'unknown.csv',
    context,
  );
  const branchId = (await views.fridge(imported.fridgeId, {})).branch.id;
  const all = await views.dashboard({ branchId, status: 'quality' });
  assert.equal(all.fridges.length, 1);
  assert.equal(all.fridges[0].qualityCount, 1);
  assert.equal(all.fridges[0].undatedCount, 1);
  assert.equal(all.fridges[0].status, 'quality');
  assert.equal(all.counts.quality, 1);

  for (const range of [
    { from: '2042-01-02' },
    { to: '2042-01-02' },
    { from: '2042-01-02', to: '2042-01-02' },
  ]) {
    const result = await views.dashboard({ branchId, ...range });
    assert.equal(result.fridges[0].qualityCount, 0);
    assert.equal(result.fridges[0].undatedCount, 1);
    assert.equal(result.fridges[0].status, 'clear');
    assert.equal(result.counts.quality, 0);
    assert.equal(result.counts.clear, 1);
    assert.equal(
      (await views.dashboard({ branchId, ...range, status: 'quality' })).fridges.length,
      0,
    );
    assert.equal((await views.fridge(imported.fridgeId, range)).undatedQuality.length, 1);
  }
  const emptyPeriod = await views.dashboard({ branchId, from: '2050-01-01' });
  assert.equal(emptyPeriod.fridges[0].status, 'no-data');
  assert.equal(emptyPeriod.fridges[0].undatedCount, 1);
  assert.equal(emptyPeriod.counts.quality, 0);
  assert.equal(emptyPeriod.counts.noData, 1);

  await imports.importCsv(csv('2042-01-02 06:15,ERR'), 'dated.csv', context);
  const dated = await views.dashboard({
    branchId,
    from: '2042-01-02',
    to: '2042-01-02',
    status: 'quality',
  });
  assert.equal(dated.fridges.length, 1);
  assert.equal(dated.fridges[0].qualityCount, 1);
  assert.equal(dated.fridges[0].undatedCount, 1);
  assert.equal(dated.fridges[0].status, 'quality');
  assert.equal(dated.counts.quality, 1);
  assert.equal((await views.dashboard({ branchId })).fridges[0].qualityCount, 2);
});
