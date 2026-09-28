import { describe, expect, it } from 'vitest';
import type { Reading } from '../api/types';
import { chartSegments } from './chart-segments';

const row = (time: string, overrides: Partial<Reading> = {}): Reading => ({
  id: time,
  recordedAt: `2040-01-01T${time}:00`,
  temperatureCelsius: 6,
  status: 'VALID',
  validationError: null,
  loggerId: 'logger',
  loggerExternalId: 'NEW-ID',
  assignmentId: 'first',
  expectedIntervalMinutes: 15,
  ...overrides,
});
describe('chart continuity', () => {
  it('does not plot a valid value sharing a timestamp with ERR', () => {
    const segments = chartSegments([
      row('06:00'),
      row('06:15'),
      row('06:15', { status: 'INVALID', temperatureCelsius: null }),
      row('06:30'),
    ]);
    expect(segments.map((s) => s.map((p) => p.recordedAt.slice(11, 16)))).toEqual([
      ['06:00'],
      ['06:30'],
    ]);
  });
  it('breaks across missed observations, interval changes and assignments', () => {
    expect(
      chartSegments([
        row('06:00'),
        row('06:15'),
        row('06:45'),
        row('07:00', { expectedIntervalMinutes: 10 }),
        row('07:10', { expectedIntervalMinutes: 10, assignmentId: 'second' }),
      ]).map((s) => s.length),
    ).toEqual([2, 1, 1, 1]);
  });
  it('omits conflicting values and intervals; coalesces identical observations', () => {
    expect(
      chartSegments([
        row('06:00'),
        row('06:00'),
        row('06:15'),
        row('06:15', { temperatureCelsius: 7 }),
        row('06:30'),
        row('06:30', { expectedIntervalMinutes: 10 }),
        row('06:45'),
      ]).map((s) => s.length),
    ).toEqual([1, 1]);
  });
  it('uses calendar spacing without timezone conversion across dates', () => {
    const segments = chartSegments([
      row('23:45'),
      row('00:00', { recordedAt: '2040-01-02T00:00:00' }),
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0][1].x - segments[0][0].x).toBe(15);
  });
});
