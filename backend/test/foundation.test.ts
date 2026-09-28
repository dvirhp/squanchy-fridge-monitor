import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const directory = mkdtempSync(join(tmpdir(), 'squanchy-foundation-'));
const url = 'file:' + join(directory, 'test.db').replaceAll('\\', '/');
const environment = { ...process.env, DATABASE_URL: url };
const prisma = new PrismaClient({ datasources: { db: { url } } });
const run = (entry: string, args: string[]) => execFileSync(process.execPath, [
  entry === 'prisma' ? join(dirname(require.resolve('prisma/package.json')), 'build/index.js') : require.resolve(entry),
  ...args,
], {
  env: environment, encoding: 'utf8', stdio: 'pipe',
});
const counts = async () => ({
  branches: await prisma.branch.count(), fridges: await prisma.fridge.count(),
  loggers: await prisma.logger.count(), assignments: await prisma.loggerAssignment.count(),
  imports: await prisma.import.count(), readings: await prisma.reading.count(), incidents: await prisma.incident.count(),
});

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

test('fresh migration and repeated seed produce stable fixtures without incidents', async () => {
  const expected = { branches: 4, fridges: 5, loggers: 4, assignments: 5, imports: 5, readings: 15, incidents: 0 };
  assert.deepEqual(await counts(), expected);
  run('tsx/cli', ['prisma/seed.ts']);
  assert.deepEqual(await counts(), expected);
  assert.equal(await prisma.branch.count({ where: { normalizedName: 'tel aviv' } }), 1);
});

test('source and canonical measurement times stay local, and ERR stays invalid', async () => {
  const reading = await prisma.reading.findUniqueOrThrow({ where: { id: 'demo-reading-fahrenheit-0' } });
  assert.equal(reading.rawTimestamp, '14/09/2026 06:00');
  assert.equal(reading.recordedAt, '2026-09-14T06:00:00');
  assert.equal(reading.temperatureCelsius, 3.5);
  const invalid = await prisma.reading.findUniqueOrThrow({ where: { id: 'demo-reading-gap-invalid-1' } });
  assert.equal(invalid.rawTemperature, 'ERR');
  assert.equal(invalid.temperatureCelsius, null);
  assert.equal(invalid.status, 'INVALID');
});

test('exact duplicate key is rejected by the database', async () => {
  const { id, ...data } = await prisma.reading.findUniqueOrThrow({ where: { id: 'demo-reading-spike-0' } });
  await assert.rejects(prisma.reading.create({ data }), { code: 'P2002' });
  assert.equal(await prisma.reading.count(), 15);
});

test('assignment edits and logger unit edits cannot reattribute historical imports or readings', async () => {
  const rollback = new Error('rollback test mutation');
  await assert.rejects(prisma.$transaction(async tx => {
    const original = await tx.import.findUniqueOrThrow({ where: { id: 'demo-import-spike' } });
    const moved = await tx.import.findUniqueOrThrow({ where: { id: 'demo-import-moved' } });
    assert.notEqual(original.fridgeId, moved.fridgeId);
    await tx.loggerAssignment.update({
      where: { id: original.assignmentId }, data: { fridgeId: moved.fridgeId, validTo: '2026-09-14T23:00:00' },
    });
    await tx.logger.update({ where: { id: original.loggerId }, data: { temperatureUnit: 'FAHRENHEIT' } });
    const unchanged = await tx.import.findUniqueOrThrow({ where: { id: original.id } });
    assert.equal(unchanged.fridgeId, original.fridgeId);
    assert.equal(unchanged.temperatureUnit, 'CELSIUS');
    const reading = await tx.reading.findUniqueOrThrow({ where: { id: 'demo-reading-spike-0' } });
    assert.equal(reading.fridgeId, original.fridgeId);
    assert.equal(reading.temperatureCelsius, 4);
    throw rollback;
  }), error => error === rollback);
});

test('readings cannot reference a different fridge than their import snapshot', async () => {
  const { id, ...data } = await prisma.reading.findUniqueOrThrow({ where: { id: 'demo-reading-spike-0' } });
  const moved = await prisma.import.findUniqueOrThrow({ where: { id: 'demo-import-moved' } });
  await assert.rejects(prisma.reading.create({
    data: { ...data, fridgeId: moved.fridgeId, deduplicationKey: 'invalid-context-test' },
  }), { code: 'P2003' });
});

test('Task 1 fixture labels and legacy keys upgrade without changing historical IDs or values', async () => {
  const old = await prisma.import.findUniqueOrThrow({ where: { id: 'demo-import-fahrenheit' } });
  const reading = await prisma.reading.findUniqueOrThrow({ where: { id: 'demo-reading-fahrenheit-0' } });
  await prisma.logger.update({ where: { id: old.loggerId }, data: { externalId: 'TL-0600' } });
  await prisma.fridge.update({ where: { id: old.fridgeId }, data: { name: 'Pastries', normalizedName: 'pastries' } });
  await prisma.reading.update({ where: { id: reading.id }, data: {
    deduplicationKey: JSON.stringify([reading.loggerId, reading.recordedAt, reading.temperatureCelsius]),
  } });
  run('tsx/cli', ['prisma/seed.ts']);
  const updated = await prisma.import.findUniqueOrThrow({ where: { id: old.id }, include: { logger: true, fridge: true } });
  assert.equal(updated.logger.externalId, 'TL-0231'); assert.equal(updated.fridge.name, 'Dairy');
  assert.equal(updated.loggerId, old.loggerId); assert.equal(updated.fridgeId, old.fridgeId);
  const after = await prisma.reading.findUniqueOrThrow({ where: { id: reading.id } });
  assert.equal(after.temperatureCelsius, reading.temperatureCelsius);
  assert.equal(after.fridgeId, reading.fridgeId); assert.equal(after.deduplicationKey, reading.deduplicationKey);
});
