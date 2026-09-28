import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeReading, normalizeTimestamp } from '../src/imports/reading-normalizer';
import { validateReading } from '../src/imports/reading-validator';
import { readingIdentity } from '../src/imports/reading-identity';

const raw = (temperature = '4.1', time = '14/09/2026 06:00') => ({
  rawTemperature: temperature, rawTimestamp: time, sourceRowNumber: 2,
});
test('Celsius, Fahrenheit, and both timestamp formats normalize generically', () => {
  const c = validateReading(normalizeReading(raw(), 'CELSIUS'));
  assert.equal(c.temperatureCelsius, 4.1);
  assert.equal(c.recordedAt, '2026-09-14T06:00:00');
  assert.equal(c.status, 'VALID');
  assert.ok(Math.abs(normalizeReading(raw('38.3'), 'FAHRENHEIT').temperatureCelsius! - 3.5) < 1e-12);
  assert.equal(normalizeReading(raw('38.3'), 'CELSIUS').temperatureCelsius, 38.3);
  assert.equal(normalizeTimestamp('2031-02-03 07:00'), '2031-02-03T07:00:00');
});
test('invalid values preserve source and valid independent fields', () => {
  const err = validateReading(normalizeReading(raw('ERR'), 'CELSIUS'));
  assert.equal(err.status, 'INVALID'); assert.equal(err.temperatureCelsius, null);
  assert.equal(err.rawTemperature, 'ERR'); assert.match(err.validationError!, /temperature/);
  const badTime = validateReading(normalizeReading(raw('4.2', 'not-a-time'), 'CELSIUS'));
  assert.equal(badTime.recordedAt, null); assert.equal(badTime.temperatureCelsius, 4.2);
  assert.equal(badTime.rawTimestamp, 'not-a-time'); assert.equal(badTime.status, 'INVALID');
});
test('calendar validation rejects rollover and timezone-bearing timestamps', () => {
  for (const input of ['2025-02-29 06:00', '2031-04-31 00:00', '2031-13-01 00:00', '2031-01-01 24:00', '2031-01-01T00:00:00Z']) {
    assert.equal(normalizeTimestamp(input), null);
  }
  assert.equal(normalizeTimestamp('2028-02-29 06:00:59'), '2028-02-29T06:00:59');
});
test('numeric grammar rejects empty, nonfinite, partial, exponent and hex values', () => {
  for (const value of ['', ' ', 'NaN', 'Infinity', '4C', '1e2', '0x10', '9'.repeat(400)]) {
    assert.equal(validateReading(normalizeReading(raw(value), 'CELSIUS')).status, 'INVALID');
  }
});
test('canonical identity unifies numeric formatting but preserves distinct values and invalid context', () => {
  const context = { loggerId: 'unseen', fridgeId: 'new-fridge', temperatureUnit: 'CELSIUS' as const };
  const key = (v: string) => readingIdentity(validateReading(normalizeReading(raw(v), 'CELSIUS')), context);
  assert.equal(key('4.1'), key('4.10'));
  assert.notEqual(key('4.1'), key('4.1000001'));
  const invalid = validateReading(normalizeReading(raw('ERR'), 'CELSIUS'));
  assert.notEqual(readingIdentity(invalid, context), readingIdentity(invalid, { ...context, fridgeId: 'another' }));
});
